/**
 * The CLI's own identity, baked in at build time from package.json.
 *
 * `CLIENT_HEADER` is sent as `X-LumifyHub-Client` on every request so the
 * server can record provenance ("via lh/0.3.0" on a card's timeline). Shape
 * matches dispatch's `dispatch; session=<name>`: a short client name, then
 * optional `; key=value` details.
 */
export const VERSION: string = __LH_VERSION__;
export const CLIENT_NAME = "lh";
export const CLIENT_HEADER = `${CLIENT_NAME}/${VERSION}`;
