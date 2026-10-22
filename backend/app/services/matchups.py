from typing import Any, cast

import nflreadpy as nfl
import pandas as pd

from app.cache import memoized
from app.data import pbp as pbp_data
from app.data import pfr_defense, player_stats, schedules, snap_counts
from app.services import extended_stats, players

REGULAR_SEASON = "REG"
SCRIMMAGE_PLAYS = {"pass", "run"}

# What the frontend reads off a game. The schedule row also carries betting
# lines, weather, officials and venue detail; none of it is shown, so none of
# it is sent.
PREVIEW_FIELDS = [
    "game_id",
    "season",
    "game_type",
    "week",
    "gameday",
    "weekday",
    "gametime",
    "away_team",
    "home_team",
    "away_score",
    "home_score",
    "div_game",
]


class GameNotFoundError(Exception):
    """No game in the current season carries this game_id."""


@memoized
def get_matchup(game_id: str) -> dict[str, Any]:
    """One game, as either a preview or a breakdown.

    A game that hasn't been played gets a preview: the line, the quarterbacks,
    and how each team's offense has fared against the kind of defense it's
    about to meet. A game that's final gets a breakdown of what actually
    happened in it, drive by drive.
    """
    season = nfl.get_current_season()
    schedule = schedules.get_season_schedule(season)
    if schedule.empty:
        season -= 1
        schedule = schedules.get_season_schedule(season)

    games = schedule[schedule["game_id"] == game_id]
    if games.empty:
        raise GameNotFoundError(f"No game found for game_id: {game_id}")
    game = games.iloc[0]

    plays = pbp_data.get_season_pbp(season)
    played = bool(pd.notna(game["home_score"]))
    matchup: dict[str, Any] = {
        "status": "final" if played else "scheduled",
        "game": _scalars(game[PREVIEW_FIELDS]),
    }
    teams = (str(game["away_team"]), str(game["home_team"]))
    if played:
        matchup["breakdown"] = _breakdown(plays, game_id, teams, season, int(game["week"]))
    else:
        matchup["preview"] = _preview(plays, teams, season)
    return matchup


def _preview(plays: pd.DataFrame, teams: tuple[str, str], season: int) -> dict[str, Any]:
    """Each team's season to date, shaped exactly like a finished game's
    breakdown so the same comparison reads either side of kickoff - only the
    numbers are per game rather than from one game. Defensive rates are
    carried too, since what decides a matchup is one team's offense against
    the other's defense.
    """
    regular = plays[plays["season_type"] == REGULAR_SEASON]
    clean = _scrimmage_plays(regular)
    pressures = _season_pressures(season)
    return {
        "teams": [
            {
                **_season_form(regular, clean, team, pressures.get(team)),
                "form": _recent_form(season, team),
            }
            for team in teams
        ],
        "leaders": _season_leaders(season, teams),
    }


def _season_form(
    regular: pd.DataFrame, clean: pd.DataFrame, team: str, pressures: int | None
) -> dict[str, Any]:
    """A team's per-game averages, keyed the same as a single game's box
    score. Averaging rather than totalling keeps two teams comparable when
    one has had its bye and the other hasn't.
    """
    own = regular[regular["posteam"] == team]
    games = int(own["game_id"].nunique())
    per = _game_team(regular, clean, team, pressures)
    counted = (
        "plays",
        "yards",
        "pass_yards",
        "pass_plays",
        "rush_yards",
        "rush_plays",
        "first_downs",
        "interceptions",
        "fumbles_lost",
        "turnovers",
        "sacks",
        "penalties",
        "penalty_yards",
        "time_of_possession",
    )
    # Third downs stay as season totals: the row reads as a fraction, and
    # "5.3 of 14.5" is a worse way to say 32 of 87.
    if games > 0:
        for key in counted:
            value = per[key]
            per[key] = round(value / games, 1) if isinstance(value, int | float) else value
        if per["pressures"] is not None:
            per["pressures"] = round(per["pressures"] / games, 1)
        for phase in ("overall", "pass", "run"):
            total = per["offense"][phase]["epa"]
            if total is not None:
                per["offense"][phase]["epa"] = round(total / games, 2)

    per["games"] = games
    per["defense"] = _unit_rates(clean[clean["defteam"] == team])
    return per


# How many recent results a preview carries.
RECENT_GAMES = 3


def _recent_form(season: int, team: str) -> list[dict[str, Any]]:
    """The team's last few results, newest first - what a preview's averages
    can't say, which is whether a team is playing well right now.
    """
    try:
        played = schedules.get_played_games(season)
    except Exception:
        return []
    if played.empty:
        return []
    # Straight off the schedule rather than the melted game log, because each
    # result links to its own matchup and so needs the game_id with it.
    side = played[(played["home_team"] == team) | (played["away_team"] == team)]
    side = side.sort_values("week", ascending=False, kind="stable")
    rows = []
    for _, game in side.head(RECENT_GAMES).iterrows():
        home = game["home_team"] == team
        points_for = int(game["home_score"] if home else game["away_score"])
        points_against = int(game["away_score"] if home else game["home_score"])
        rows.append(
            {
                "game_id": str(game["game_id"]),
                "week": int(game["week"]),
                "opponent": str(game["away_team"] if home else game["home_team"]),
                "home": bool(home),
                "points_for": points_for,
                "points_against": points_against,
                "result": "W"
                if points_for > points_against
                else "L"
                if points_for < points_against
                else "T",
            }
        )
    return rows


def _season_pressures(season: int) -> dict[str, int]:
    """Season pressures by team. Unlike one game's, these are rarely missing:
    PFR has charted every week but the most recent by the time it matters.
    """
    try:
        defense = pfr_defense.get_season_pfr_defense(season)
    except Exception:
        return {}
    if defense.empty or "team" not in defense.columns:
        return {}
    totals = defense.groupby("team")["def_pressures"].sum()
    return {str(team): int(total) for team, total in totals.items()}


def _unit_rates(unit: pd.DataFrame) -> dict[str, Any]:
    """EPA and success rate for one unit, overall and split by pass and run -
    the split matters because a defense can be stout against one and not the
    other, which is exactly what a matchup turns on.
    """
    rates: dict[str, Any] = {"plays": int(len(unit))}
    for key, subset in (
        ("overall", unit),
        ("pass", unit[unit["play_type"] == "pass"]),
        ("run", unit[unit["play_type"] == "run"]),
    ):
        rates[key] = {
            "plays": int(len(subset)),
            "epa": round(float(subset["epa"].sum()), 2) if not subset.empty else None,
            "epa_per_play": _mean(subset["epa"]),
            "success_rate": _mean(subset["success"], scale=100),
        }
    return rates


def _breakdown(
    plays: pd.DataFrame, game_id: str, teams: tuple[str, str], season: int, week: int
) -> dict[str, Any]:
    """What happened in the game: how each side moved the ball, every drive's
    outcome, and the swing in win probability that produced the result.
    """
    game_plays = plays[plays["game_id"] == game_id]
    clean = _scrimmage_plays(game_plays)
    pressures = _pressures_by_team(game_id, season)
    return {
        "teams": [_game_team(game_plays, clean, team, pressures.get(team)) for team in teams],
        "line_score": _line_score(game_plays),
        "drives": _drives(game_plays),
        "win_probability": _win_probability(game_plays),
        "leaders": _leaders(game_id, season, week, teams),
        "box_score": _box_score(game_id, season, week, teams),
    }


def _line_score(game_plays: pd.DataFrame) -> list[dict[str, int]]:
    """Points scored in each quarter, from the running score at the end of
    one quarter against the end of the last. Quarter 5 and up are overtime.
    """
    scored = game_plays[game_plays["total_home_score"].notna() & game_plays["qtr"].notna()]
    rows = []
    previous = {"away": 0, "home": 0}
    for quarter, plays in scored.groupby("qtr", sort=True):
        last = plays.iloc[-1]
        totals = {"away": int(last["total_away_score"]), "home": int(last["total_home_score"])}
        rows.append(
            {
                "quarter": int(cast(float, quarter)),
                "away": totals["away"] - previous["away"],
                "home": totals["home"] - previous["home"],
            }
        )
        previous = totals
    return rows


def _game_team(
    game_plays: pd.DataFrame, clean: pd.DataFrame, team: str, pressures: int | None
) -> dict[str, Any]:
    """One team's box score. Yardage is `yards_gained` on scrimmage plays, so
    passing yardage is net of sacks, the way a box score states it.
    Interceptions and fumbles are this team's giveaways; sacks and pressures
    are what its defense produced.
    """
    offense = clean[clean["posteam"] == team]
    own = game_plays[game_plays["posteam"] == team]
    against = game_plays[game_plays["defteam"] == team]
    third_downs = own[(own["down"] == 3) & own["third_down_converted"].notna()]
    penalties = own[own["penalty_team"] == team]
    passing = offense[offense["play_type"] == "pass"]
    rushing = offense[offense["play_type"] == "run"]
    return {
        "team": team,
        "offense": _unit_rates(offense),
        "plays": int(len(offense)),
        "yards": int(offense["yards_gained"].sum()),
        "pass_yards": int(passing["yards_gained"].sum()),
        "pass_plays": int(len(passing)),
        "rush_yards": int(rushing["yards_gained"].sum()),
        "rush_plays": int(len(rushing)),
        "first_downs": int(own["first_down"].fillna(0).sum()),
        "interceptions": int(own["interception"].sum()),
        "fumbles_lost": int(own["fumble_lost"].sum()),
        "turnovers": int(own["interception"].sum() + own["fumble_lost"].sum()),
        "sacks": int(against["sack"].fillna(0).sum()),
        "pressures": pressures,
        "penalties": int(len(penalties)),
        "penalty_yards": int(penalties["penalty_yards"].sum()),
        "time_of_possession": _time_of_possession(own),
        "third_down_attempts": int(len(third_downs)),
        "third_down_conversions": int(third_downs["third_down_converted"].sum()),
    }


def _time_of_possession(own: pd.DataFrame) -> int:
    """Seconds held, summed over the team's drives. nflverse states a drive's
    time of possession as "M:SS", once per play on the drive.
    """
    keys = ["game_id", "drive"] if "game_id" in own.columns else ["drive"]
    drives = own[[*keys, "drive_time_of_possession"]].dropna().drop_duplicates(keys)
    seconds = 0
    for clock in drives["drive_time_of_possession"]:
        minutes, _, rest = str(clock).partition(":")
        if rest.isdigit() and minutes.lstrip("-").isdigit():
            seconds += int(minutes) * 60 + int(rest)
    return seconds


def _pressures_by_team(game_id: str, season: int) -> dict[str, int]:
    """Pressures come from PFR's advanced defense, not play-by-play, and PFR
    posts them a little later than the pbp - so a just-finished game has none
    and the frontend shows a dash rather than a zero.
    """
    try:
        defense = pfr_defense.get_season_pfr_defense(season)
    except Exception:
        return {}
    if defense.empty or "game_id" not in defense.columns:
        return {}
    game = defense[defense["game_id"] == game_id]
    totals = game.groupby("team")["def_pressures"].sum()
    return {str(team): int(total) for team, total in totals.items()}


def _drives(game_plays: pd.DataFrame) -> list[dict[str, Any]]:
    """One row per drive, in order. fixed_drive numbers every drive in the
    game (unlike `drive`, which nflverse leaves gapped), and the first play of
    a drive can be a kickoff with no posteam, so the team comes from the
    drive's plays rather than its first row.
    """
    drives = game_plays[game_plays["fixed_drive"].notna() & game_plays["posteam"].notna()]
    rows = []
    for number, drive in drives.groupby("fixed_drive", sort=True):
        first = drive.iloc[0]
        rows.append(
            {
                "drive": int(cast(float, number)),
                "team": str(first["posteam"]),
                "quarter": int(first["qtr"]),
                "result": _text(first["fixed_drive_result"]),
                "plays": int(len(drive)),
                "yards": int(drive["yards_gained"].sum()),
            }
        )
    return rows


def _win_probability(game_plays: pd.DataFrame) -> list[dict[str, Any]]:
    """The home team's win probability at each play, on a clock that counts
    up from kickoff so the frontend can plot it left to right.
    """
    wp = game_plays[game_plays["home_wp"].notna() & game_plays["game_seconds_remaining"].notna()]
    wp = wp.sort_values("game_seconds_remaining", ascending=False, kind="stable")
    return [
        {
            "elapsed": int(3600 - float(row["game_seconds_remaining"])),
            "quarter": int(row["qtr"]),
            "home_wp": round(float(row["home_wp"]) * 100, 1),
        }
        for _, row in wp.iterrows()
    ]


def _scrimmage_plays(plays: pd.DataFrame) -> pd.DataFrame:
    return plays[plays["play_type"].isin(SCRIMMAGE_PLAYS) & plays["epa"].notna()]


def _mean(values: "pd.Series[Any]", scale: float = 1) -> float | None:
    if values.empty:
        return None
    return round(float(values.mean()) * scale, 3 if scale == 1 else 1)


def _text(value: Any) -> str | None:
    return None if pd.isna(value) else str(value)


def _scalars(row: "pd.Series[Any]") -> dict[str, Any]:
    """NaN isn't JSON, so every missing schedule value becomes null."""
    return cast(dict[str, Any], row.astype(object).where(row.notna(), None).to_dict())


# (key, label, stat column) for the leaders row. Pressures come from PFR
# instead, so they're resolved separately.
LEADER_STATS = (
    ("passing_yards", "Passing Yards", "passing_yards"),
    ("rushing_yards", "Rushing Yards", "rushing_yards"),
    ("receiving_yards", "Receiving Yards", "receiving_yards"),
    ("tackles", "Tackles", "total_tackles"),
    ("sacks", "Sacks", "def_sacks"),
)



def _leaders(game_id: str, season: int, week: int, teams: tuple[str, str]) -> list[dict[str, Any]]:
    """Each team's best player in the game for each category, so the two sit
    side by side. A category with nobody above zero is dropped rather than
    shown as a 0-yard "leader".
    """
    stats = player_stats.get_week_stats(season)
    game = stats[(stats["week"] == week) & stats["team"].isin(teams)].copy()
    if game.empty:
        return []
    game["total_tackles"] = extended_stats.total_tackles(game)
    pressures = _player_pressures(game_id, season)
    headshots = players.headshot_by_id()

    rows = []
    for key, label, column in LEADER_STATS:
        leaders = [_leader_in(game, column, team, headshots) for team in teams]
        if any(leader is not None for leader in leaders):
            rows.append({"key": key, "label": label, "leaders": leaders})
    if pressures is not None:
        # PFR's defense table has no position, so it comes from the week's
        # stats by player id, the same place every other leader's does.
        positions = game.set_index("player_id")["position"].to_dict()
        leaders = [_pressure_leader(pressures, team, headshots, positions) for team in teams]
        if any(leader is not None for leader in leaders):
            rows.append({"key": "pressures", "label": "Pressures", "leaders": leaders})
    return rows


def _leader_in(
    game: pd.DataFrame, column: str, team: str, headshots: dict[str, str]
) -> dict[str, Any] | None:
    side = game[(game["team"] == team) & (game[column] > 0)]
    if side.empty:
        return None
    best = side.nlargest(1, column, keep="first").iloc[0]
    player_id = _text(best["player_id"])
    return {
        "team": team,
        "player_id": player_id,
        "name": _text(best["player_display_name"]),
        "position": _text(best["position"]),
        "headshot_url": headshots.get(player_id or ""),
        "value": round(float(best[column]), 1),
    }


def _player_pressures(game_id: str, season: int) -> pd.DataFrame | None:
    """PFR's per-player pressures for this game, carrying the gsis id so the
    frontend can link the player like every other leader.
    """
    try:
        defense = pfr_defense.get_season_pfr_defense(season)
    except Exception:
        return None
    if defense.empty or "game_id" not in defense.columns:
        return None
    game = defense[(defense["game_id"] == game_id) & (defense["def_pressures"] > 0)]
    if game.empty:
        return None
    gsis = snap_counts.get_pfr_to_gsis_map()
    game = game.copy()
    game["player_id"] = game["pfr_player_id"].map(gsis)
    return game


def _pressure_leader(
    game: pd.DataFrame,
    team: str,
    headshots: dict[str, str],
    positions: dict[Any, Any],
) -> dict[str, Any] | None:
    side = game[game["team"] == team]
    if side.empty:
        return None
    best = side.nlargest(1, "def_pressures", keep="first").iloc[0]
    player_id = _text(best["player_id"])
    return {
        "team": team,
        "player_id": player_id,
        "name": _text(best["pfr_player_name"]),
        "position": _text(positions.get(player_id)) if player_id else None,
        "headshot_url": headshots.get(player_id or ""),
        "value": round(float(best["def_pressures"]), 1),
    }


# (section, sort column, columns kept) for the box score. A player appears in
# a section only once he has a number in it, so the tables stay short.
BOX_SECTIONS = (
    ("passing", "passing_yards",
     ("completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions",
      "sacks_suffered")),
    ("rushing", "rushing_yards",
     ("carries", "rushing_yards", "rushing_tds", "rushing_fumbles_lost")),
    ("receiving", "receiving_yards",
     ("targets", "receptions", "receiving_yards", "receiving_tds", "receiving_fumbles_lost")),
    ("defense", "total_tackles",
     ("total_tackles", "def_sacks", "def_interceptions", "def_tds")),
)


def _box_score(
    game_id: str, season: int, week: int, teams: tuple[str, str]
) -> list[dict[str, Any]]:
    """Every player who did something in the game, by team and by section."""
    stats = player_stats.get_week_stats(season)
    game = stats[(stats["week"] == week) & stats["team"].isin(teams)].copy()
    if game.empty:
        return []
    game["total_tackles"] = extended_stats.total_tackles(game)
    pressures = _player_pressures(game_id, season)
    by_player = (
        {} if pressures is None else pressures.set_index("player_id")["def_pressures"].to_dict()
    )

    return [_box_team(game, team, by_player) for team in teams]


def _box_team(game: pd.DataFrame, team: str, pressures: dict[Any, Any]) -> dict[str, Any]:
    side = game[game["team"] == team]
    box: dict[str, Any] = {"team": team}
    for section, sort_column, columns in BOX_SECTIONS:
        played = side[side[list(columns)].fillna(0).abs().sum(axis=1) > 0]
        rows = []
        for _, player in played.sort_values(sort_column, ascending=False, kind="stable").iterrows():
            row: dict[str, Any] = {
                "player_id": _text(player["player_id"]),
                "name": _text(player["player_display_name"]),
                "position": _text(player["position"]),
            }
            row.update({column: _number(player[column]) for column in columns})
            if section == "defense":
                row["pressures"] = pressures.get(player["player_id"])
            rows.append(row)
        box[section] = rows
    return box


def _number(value: Any) -> int | float | None:
    if pd.isna(value):
        return None
    number = float(value)
    return int(number) if number.is_integer() else round(number, 1)


def _season_leaders(season: int, teams: tuple[str, str]) -> list[dict[str, Any]]:
    """The same categories a finished game's leaders use, over the season so
    far - who each side leans on, rather than who had the day.
    """
    stats = player_stats.get_season_stats(season)
    side = stats[stats["recent_team"].isin(teams)].copy()
    if side.empty:
        return []
    side["team"] = side["recent_team"]
    side["total_tackles"] = extended_stats.total_tackles(side)
    # Per game, like the comparison beside it: a player who has missed games
    # shouldn't read as less productive than one who hasn't.
    played = side["games"].where(side["games"] > 0)
    for _, _, column in LEADER_STATS:
        side[column] = side[column] / played
    # Averaging rewards a short sample: three sacks in the one game a player
    # featured in would lead a team whose starter has played every week. Half
    # the team's games is the bar to be its leader.
    minimum = max(1, round(float(side["games"].max()) / 2))
    side = side[side["games"] >= minimum]
    if side.empty:
        return []
    headshots = players.headshot_by_id()

    rows = []
    for key, label, column in LEADER_STATS:
        leaders = [_leader_in(side, column, team, headshots) for team in teams]
        if any(leader is not None for leader in leaders):
            rows.append({"key": key, "label": label, "leaders": leaders})

    pressures = _season_player_pressures(season)
    if pressures is not None:
        positions = side.set_index("player_id")["position"].to_dict()
        games = side.set_index("player_id")["games"].to_dict()
        pressures = pressures[pressures["player_id"].isin(games)].copy()
        pressures["def_pressures"] = pressures.apply(
            lambda row: row["def_pressures"] / games[row["player_id"]], axis=1
        )
        leaders = [_pressure_leader(pressures, team, headshots, positions) for team in teams]
        if any(leader is not None for leader in leaders):
            rows.append({"key": "pressures", "label": "Pressures", "leaders": leaders})
    return rows


def _season_player_pressures(season: int) -> pd.DataFrame | None:
    """Season pressures per player, summed across games and carrying the gsis
    id so a leader links like every other one.
    """
    try:
        defense = pfr_defense.get_season_pfr_defense(season)
    except Exception:
        return None
    if defense.empty or "team" not in defense.columns:
        return None
    totals = (
        defense.groupby(["team", "pfr_player_id", "pfr_player_name"])["def_pressures"]
        .sum()
        .reset_index()
    )
    totals = totals[totals["def_pressures"] > 0]
    if totals.empty:
        return None
    totals["player_id"] = totals["pfr_player_id"].map(snap_counts.get_pfr_to_gsis_map())
    return totals
