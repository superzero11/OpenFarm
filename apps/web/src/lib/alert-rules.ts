/**
 * Alert rule names as emitted by the API's rule engine.
 *
 * The display label for each lives in messages/*.json under `alertRules`,
 * so it translates and follows the sentence-case rule like every other
 * user-facing string. Keep this list in sync with the rules evaluated in
 * services/api/app/tasks/pipeline.py and tasks/soil.py.
 */
export const ALERT_RULE_NAMES = [
    "ndvi_drop",
    "ndvi_threshold",
    "evi_drop",
    "evi_threshold",
    "savi_drop",
    "savi_threshold",
    "ndwi_drop",
    "ndwi_threshold",
    "soil_ph_critical",
    "soil_ph_warning",
    "soil_soc_critical",
    "soil_soc_warning",
    "soil_sand_erosion",
    "soil_cec_low",
    "soil_compaction",
    "soil_waterlogging",
] as const;

const KNOWN = new Set<string>(ALERT_RULE_NAMES);

/**
 * Translate a rule name, falling back to the raw value.
 *
 * A rule added to the API before the message files catch up must still
 * render something, so an unknown name passes through rather than
 * throwing a missing-message error at the user.
 */
export function ruleLabel(
    ruleName: string,
    t: (key: string) => string,
): string {
    return KNOWN.has(ruleName) ? t(ruleName) : ruleName;
}
