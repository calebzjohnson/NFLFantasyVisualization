// metricGlossary.ts
// Plain-language explanations of every stat in the player and team catalogs (playerMetrics, teamMetrics), keyed by metric key, for "What do these stats mean?".
// A key means the same thing in every catalog it appears in (e.g. ypc for a
// back and for a team), so each is written to fit both. A test checks that
// every catalog stat has an entry here.
export const METRIC_GLOSSARY: Record<string, string> = {
  // Passing
  completions: "Passes thrown that were caught.",
  attempts: "Passes thrown.",
  completion_pct: "Share of passes thrown that were caught.",
  passing_yards: "Yards gained on passes thrown, counting the run after the catch.",
  passing_tds: "Touchdowns thrown.",
  passing_interceptions: "Passes thrown that the defense caught.",
  rating:
    "Passer rating - the NFL's 0 to 158.3 grade for passing, combining completion %, yards per throw, touchdowns, and interceptions.",
  epa_per_dropback:
    "Expected Points Added per dropback - how much each pass or sack changed the team's chances of scoring, on average. Above 0 means better than an average QB in the same spots.",
  passing_cpoe:
    "Completion % Over Expected - how many more of his passes are caught than an average QB would complete on the same throws, in percentage points.",
  sacks_suffered: "Times he was tackled behind the line of scrimmage before he could throw.",
  fantasy_points_ppr:
    "Fantasy points in a standard PPR league: a point per catch, a point per 10 rushing or receiving yards, a point per 25 passing yards, 6 per rushing or receiving touchdown, 4 per passing touchdown, and minus 2 per interception or lost fumble.",

  // Rushing
  carries: "Running plays where he took the handoff or ran it himself.",
  rushing_yards: "Yards gained on carries.",
  rushing_tds: "Touchdowns scored on carries.",
  ypc: "Yards per carry - average rushing yards gained each time the ball is run.",
  rushing_epa_per_carry:
    "Expected Points Added per carry - how much each run changed the team's chances of scoring, on average. Above 0 means better than an average run in the same spots.",

  // Receiving
  receptions: "Passes he caught.",
  targets: "Passes thrown his way, caught or not.",
  receiving_yards: "Yards gained on his catches, counting the run after the catch.",
  receiving_tds: "Touchdowns scored on his catches.",
  ypr: "Yards per reception - average yards gained on each catch.",
  epa_per_target:
    "Expected Points Added per target - how much each pass thrown his way changed the team's chances of scoring, on average.",
  target_share: "His share of all the passes his team threw.",
  air_yards_share:
    "His share of the team's air yards - how far passes travel downfield before they're caught - so it rewards deep targets more than short ones.",
  wopr: "Weighted Opportunity Rating - blends his share of the team's targets and of its passing yardage downfield into one measure of how involved he is.",

  // Defense
  tackles: "Tackles made, alone or with a teammate.",
  def_tackles_solo: "Tackles made by himself, with no teammate helping.",
  def_tackles_for_loss: "Tackles of a ball carrier behind the line of scrimmage, so the offense lost yards.",
  def_sacks: "Tackles of the quarterback behind the line of scrimmage before he could throw.",
  def_qb_hits: "Times he hit the quarterback as or just after he threw.",
  def_pressures: "Times he got to the quarterback or forced him to hurry: sacks, hits, and hurries together.",
  def_times_hurried: "Times he forced the quarterback to throw early or move, without a sack or hit.",
  def_fumbles_forced: "Times he knocked the ball loose from a ball carrier.",
  def_pass_defended: "Passes he broke up or intercepted.",
  def_interceptions: "Passes he caught for the defense.",
  defense_snaps: "Defensive plays he was on the field for.",
  defense_snap_pct: "Share of his team's defensive plays he was on the field for.",
  pressure_rate: "Pressures (sacks, hits, and hurries) per 100 defensive plays he was on the field for.",
  missed_tackle_pct: "Share of his tackle attempts that he missed.",
  def_targets: "Passes thrown at a receiver he was covering.",
  def_completions_allowed: "Passes thrown his way that were caught.",
  completion_pct_allowed: "Share of passes thrown his way that were caught.",
  def_yards_allowed: "Receiving yards given up on passes thrown his way.",
  yards_per_target_allowed: "Receiving yards given up each time a pass is thrown his way.",
  def_receiving_td_allowed: "Touchdown catches given up on passes thrown his way.",
  passer_rating_allowed: "The passer rating quarterbacks have when throwing his way - lower is better for him.",

  // Offensive line
  offense_snaps: "Offensive plays he was on the field for.",
  offense_snap_pct: "Share of his team's offensive plays he was on the field for.",
  penalties: "Penalties called on him.",
  penalty_yards: "Yards his team lost to penalties called on him.",
  penalties_per_100_snaps: "Penalties called on him per 100 plays he was on the field for.",

  // Kicking
  fg_made: "Field goals made.",
  fg_att: "Field goals tried.",
  fg_pct: "Share of field goals tried that were made.",
  fg_long: "His longest made field goal, in yards.",
  fg_made_50_plus: "Field goals made from 50 yards or longer.",
  pat_made: "Extra-point kicks made after touchdowns.",
  pat_pct: "Share of extra-point kicks that were made.",

  // Punting
  pt_att: "Punts.",
  gross_avg: "Average punt distance, from the line of scrimmage to where it was caught, landed, or went out of bounds.",
  net_avg: "Average yards a punt actually gained for his team, after return yards and touchbacks.",
  pt_inside_20: "Punts that left the other team starting inside its own 20-yard line.",
  inside_20_pct: "Share of punts that left the other team starting inside its own 20-yard line.",
  pt_touchback: "Punts that went into the end zone, so the other team started at its own 20.",

  // Teams
  points: "Points scored per game.",
  yards: "Yards gained per game, passing (minus yards lost to sacks) plus rushing.",
  pass_yards: "Passing yards gained per game, minus yards lost to sacks.",
  rush_yards: "Rushing yards gained per game.",
  turnovers: "Interceptions thrown plus fumbles lost, per game - lower is better.",
  sacks_taken: "Times the team's quarterback was sacked, per game - lower is better.",
  points_allowed: "Points the defense gave up per game - lower is better.",
  yards_allowed: "Yards the defense gave up per game - lower is better.",
  pass_yards_allowed: "Passing yards the defense gave up per game, minus yards from sacks - lower is better.",
  rush_yards_allowed: "Rushing yards the defense gave up per game - lower is better.",
  sacks: "Sacks of the other team's quarterback per game.",
  takeaways: "Interceptions plus fumbles taken from the other team, per game.",
}
