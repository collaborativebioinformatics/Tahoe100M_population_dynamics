/* Tahoe-100M tools — runtime data configuration.
 *
 * The three real query tools load a versioned static dataset. The production
 * GitHub Pages release keeps compressed JSON shards and the compact signature
 * index next to the site. An external mirror can still be selected below.
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
