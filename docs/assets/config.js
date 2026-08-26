/* Tahoe-100M tools — runtime data configuration.
 *
 * The three real query tools load a versioned static dataset. Large derived
 * files (the signature index and per-condition profiles) are hosted separately
 * (e.g. Hugging Face) so they are NOT committed to Git; small selector JSON can
 * live next to the site.
 *
 * Resolution order (see assets/data.js):
 *   1. ?data=<url> in the page URL
 *   2. localStorage 'tahoe_data_base'
 *   3. window.TAHOE_DATA_BASE  (this file)
 *   4. './data/'
 *
 * To point the site at Hugging Face, set the URL below to the dataset's
 * resolve/main path, e.g.:
 *   window.TAHOE_DATA_BASE = "https://huggingface.co/datasets/<user>/tahoe100m-query-tools/resolve/main/data/";
 */
window.TAHOE_DATA_BASE = window.TAHOE_DATA_BASE || "./data/";
