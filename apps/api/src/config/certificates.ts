/**
 * Config for certificate issuance. Hiring certificates are generic
 * (DevSimulate-branded only, no employer logo) and only go to candidates
 * scoring at or above this threshold — used both by the employer's manual
 * "Issue certificates" action and by the automatic issuance that happens
 * when a candidate is rejected (so rejection isn't a dead end — they still
 * walk away with proof of their score if they earned it).
 */
export const HIRING_CERTIFICATE_MIN_SCORE = 65;
