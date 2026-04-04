// ==UserScript==
// @name        WME OpenMaps (Candy Remix)
// @author      Horizon911
// @namespace      https://github.com/horizon911/
// @contributor  Glodenox
// @contributor  petrjanik, d2-mac, MajkiiTelini (Czech WMS layers — ČÚZK definitions)
// @description This userscript augments the Waze Map Editor by allowing editors to overlay external maps (open-data cadasters, orthophotos, boundaries, plus your own Google My Maps KML) directly onto the editing canvas.
// @include     https://www.waze.com/editor*
// @include     https://www.waze.com/*/editor*
// @include     https://beta.waze.com/editor*
// @include     https://beta.waze.com/*/editor*
// @exclude     https://www.waze.com/user*
// @exclude     https://www.waze.com/*/user*
// @connect     wallonie.be
// @connect     geo.api.vlaanderen.be
// @connect     opendata.apps.mow.vlaanderen.be
// @connect     geoserver.gis.cloud.mow.vlaanderen.be
// @connect     www.mercator.vlaanderen.be
// @connect     irisnet.be
// @connect     data.mobility.brussels
// @connect     ccff02.minfin.fgov.be
// @connect     eservices.minfin.fgov.be
// @connect     nationaalgeoregister.nl
// @connect     geo.rijkswaterstaat.nl
// @connect     rj.gov.br
// @connect     wvgis.wvu.edu
// @connect     nsdig2gapps.ncsi.gov.om
// @connect     vginmaps.vdem.virginia.gov
// @connect     tnmap.tn.gov
// @connect     apps.pasda.psu.edu
// @connect     services.nationalmap.gov
// @connect     imagery.nationalmap.gov
// @connect     service.pdok.nl
// @connect     geoportal.dgu.hr
// @connect     di-ingov.img.arcgis.com
// @connect     mdgeodata.md.gov
// @connect     wmts1.geoportail.lu
// @connect     geoportal.asig.gov.al
// @connect     basemap.asig.gov.al
// @connect     di-albania-satellite1.img.arcgis.com
// @connect     webgate.ec.europa.eu
// @connect     world-tiles.waze.com
// @connect     commission.europa.eu
// @connect     www.mapwv.gov
// @connect     www.usgs.gov
// @connect     www.vdem.virginia.gov
// @connect     www.tn.gov
// @connect     www.pasda.psu.edu
// @connect     www.nconemap.gov
// @connect     www.in.gov
// @connect     opendata.maryland.gov
// @connect     www.pdok.nl
// @connect     www.rijkswaterstaat.nl
// @connect     data.vlaanderen.be
// @connect     geoportail.wallonie.be
// @connect     datastore.brussels
// @connect     data.mobility.brussels
// @connect     finances.belgium.be
// @connect     financien.belgium.be
// @connect     support.google.com
// @connect     www.vlaanderen.be
// @connect     geoportal.cuzk.gov.cz
// @connect     ags.cuzk.gov.cz
// @connect     wwf-sight-maps.org
// @connect     maratlas.discomap.eea.europa.eu
// @connect     services7.arcgis.com
// @connect     whc.unesco.org
// @connect     *
// @icon        https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Candy/3D/candy_3d.png
// @downloadURL https://update.greasyfork.org/scripts/570591/WME%20OpenMaps%20%28Candy%20Remix%29.user.js
// @updateURL   https://update.greasyfork.org/scripts/570591/WME%20OpenMaps%20%28Candy%20Remix%29.user.js
// @supportURL  https://github.com/horizon911/wme-om-cr/issues
// @tag         Candy
// @version     2026.04.04.6
// @require     https://bowercdn.net/c/html.sortable-0.4.4/dist/html.sortable.js
// @grant       GM_xmlhttpRequest
// @license     GPL v2
// ==/UserScript==

// Region map: OpenMapsSdkBootstrap (SDK + OL readiness, start of onWmeReady) · translations/settings/catalog · userMaps (GOOGLE_MY_MAPS KML; outlook: WMS/ESRI/XYZ defs) · utilities/version ·
// sidebar/tab/layers · map query · UI · tiles · layer engine/reload · styles · log · OpenMapsBoot (WME init + bootstrap entry).

/* global W, I18n, sortable, OpenLayers, Proj4js, getWmeSdk, bootstrap, unsafeWindow, GM_xmlhttpRequest, GM_info */

var styleElement;

//#region OpenMapsSdkBootstrap
/** GreasyFork script id (stable `getWmeSdk` scriptId). */
var OPEN_MAPS_SCRIPT_ID = '570591';

/** Official WME SDK instance from getWmeSdk (https://www.waze.com/editor/sdk/functions/index.getWmeSdk.html), or null. */
var openMapsWmeSdk = null;

var openMapsOlWaitAttempts = 0;
/** ~90s cap on 1s polling for OpenLayers / W.map (avoids infinite timers if the editor breaks). */
var OPEN_MAPS_OL_MAX_ATTEMPTS = 90;
var openMapsOlGiveUpLogged = false;

function openMapsResolveGetWmeSdkFn() {
  if (typeof getWmeSdk === 'function') return getWmeSdk;
  if (typeof window !== 'undefined' && typeof window.getWmeSdk === 'function') return window.getWmeSdk;
  return null;
}

/** Single call: WME throws InvalidStateError if the same script requests a different SDK version. */
function openMapsGetWmeSdkOnce() {
  var g = openMapsResolveGetWmeSdkFn();
  if (!g) return null;
  var scriptName = 'WME OpenMaps (Candy Remix)';
  try {
    if (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.name) {
      scriptName = String(GM_info.script.name);
    }
  } catch (eGm) { /* ignore */ }
  try {
    return g({ scriptId: OPEN_MAPS_SCRIPT_ID, scriptName: scriptName });
  } catch (eSdk) {
    try {
      log('getWmeSdk failed: ' + (eSdk && eSdk.message ? eSdk.message : String(eSdk)));
    } catch (eLog) { /* ignore */ }
    return null;
  }
}

//#region Hide WME Places “search this area” chip
/**
 * After a Places search, WME shows a pill to rerun the search for the current viewport. It is **WME/React UI**
 * (`container--*`, `iconContainer--*`, `.w-icon-search`, `div.text`), not OpenMaps. Older builds also used Google
 * `.gm-style` controls; we hide both.
 */
var openMapsGoogleSearchThisAreaInstalled = false;
var openMapsGoogleSearchThisAreaTimer = null;
var openMapsGoogleSearchThisAreaRaf = null;
var openMapsGoogleSearchThisAreaMapMoveInstalled = false;
/** Lowercased substrings of visible/accessible text for the chip (common WME editor languages). */
var OPEN_MAPS_GOOGLE_SEARCH_THIS_AREA_SUBSTR = [
  'search this area',
  'zoek in dit gebied',
  'in diesem gebiet suchen',
  'rechercher dans cette zone',
  'buscar en esta área',
  'buscar en esta area',
  'pesquisar nesta área',
  'pesquisar nesta area',
  'cerca in questa area',
  'szukaj na tym obszarze'
];

function openMapsNormalizeUiTextChunk(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function openMapsTextMatchesSearchThisAreaPhrase(low) {
  if (!low) return false;
  var subs = OPEN_MAPS_GOOGLE_SEARCH_THIS_AREA_SUBSTR;
  for (var si = 0; si < subs.length; si++) {
    if (low.indexOf(subs[si]) !== -1) return true;
  }
  return false;
}

/** WME module hashes change; climb from `div.text` to a `container--*` row that contains `.w-icon-search`. */
function openMapsWmeSearchThisAreaChipRootFromTextEl(textEl) {
  var el = textEl;
  for (var up = 0; up < 12 && el; up++) {
    el = el.parentElement;
    if (!el || el.nodeType !== 1) break;
    var cls = el.getAttribute('class') || '';
    if (cls.indexOf('container--') === -1) continue;
    try {
      if (el.querySelector && el.querySelector('.w-icon-search')) return el;
    } catch (eQ) { /* ignore */ }
  }
  return null;
}

function openMapsSweepHideWmePlacesSearchThisAreaChip() {
  var textNodes;
  try {
    textNodes = document.querySelectorAll('div.text');
  } catch (eTxt) {
    return;
  }
  for (var ti = 0; ti < textNodes.length; ti++) {
    var textEl = textNodes[ti];
    if (!textEl || textEl.nodeType !== 1) continue;
    var low = openMapsNormalizeUiTextChunk(textEl.textContent || '').toLowerCase();
    if (!openMapsTextMatchesSearchThisAreaPhrase(low)) continue;
    var root = openMapsWmeSearchThisAreaChipRootFromTextEl(textEl);
    if (!root) continue;
    try {
      root.style.setProperty('display', 'none', 'important');
    } catch (eH) { /* ignore */ }
  }
}

function openMapsSweepHideGoogleGmStyleSearchThisAreaChip() {
  var nodes;
  try {
    nodes = document.querySelectorAll('.gm-style button, .gm-style [role="button"]');
  } catch (eSweep) {
    return;
  }
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    if (!el || el.nodeType !== 1) continue;
    var chunks = [];
    try {
      if (el.getAttribute) {
        var al = el.getAttribute('aria-label');
        if (al) chunks.push(al);
        var tt = el.getAttribute('title');
        if (tt) chunks.push(tt);
      }
    } catch (eA) { /* ignore */ }
    try {
      chunks.push(el.textContent || '');
    } catch (eT) { /* ignore */ }
    var low = openMapsNormalizeUiTextChunk(chunks.join(' ')).toLowerCase();
    if (!openMapsTextMatchesSearchThisAreaPhrase(low)) continue;
    try {
      el.style.setProperty('display', 'none', 'important');
    } catch (eH) { /* ignore */ }
  }
}

function openMapsSweepHideGoogleSearchThisAreaChip() {
  openMapsSweepHideWmePlacesSearchThisAreaChip();
  openMapsSweepHideGoogleGmStyleSearchThisAreaChip();
}

function openMapsScheduleHideGoogleSearchThisAreaChip() {
  openMapsSweepHideGoogleSearchThisAreaChip();
  if (typeof requestAnimationFrame === 'function') {
    if (openMapsGoogleSearchThisAreaRaf != null) {
      try {
        cancelAnimationFrame(openMapsGoogleSearchThisAreaRaf);
      } catch (eC) { /* ignore */ }
    }
    openMapsGoogleSearchThisAreaRaf = requestAnimationFrame(function() {
      openMapsGoogleSearchThisAreaRaf = null;
      openMapsSweepHideGoogleSearchThisAreaChip();
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function() {
          openMapsSweepHideGoogleSearchThisAreaChip();
        });
      }
    });
  }
  if (openMapsGoogleSearchThisAreaTimer) clearTimeout(openMapsGoogleSearchThisAreaTimer);
  openMapsGoogleSearchThisAreaTimer = setTimeout(function() {
    openMapsGoogleSearchThisAreaTimer = null;
    openMapsSweepHideGoogleSearchThisAreaChip();
  }, 80);
}

/** After pan/zoom WME sometimes re-mounts the Places chip; sweep synchronously (cheap vs first-paint flash). */
function openMapsSweepHideSearchThisAreaChipAfterMapInteraction() {
  openMapsSweepHideGoogleSearchThisAreaChip();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(function() {
      openMapsSweepHideGoogleSearchThisAreaChip();
    });
  }
}

function openMapsInstallHideSearchThisAreaChipOnMapMove() {
  if (openMapsGoogleSearchThisAreaMapMoveInstalled) return;
  openMapsGoogleSearchThisAreaMapMoveInstalled = true;
  try {
    if (openMapsWmeSdk && openMapsWmeSdk.Events && typeof openMapsWmeSdk.Events.on === 'function') {
      openMapsWmeSdk.Events.on({ eventName: 'wme-map-move-end', eventHandler: openMapsSweepHideSearchThisAreaChipAfterMapInteraction });
      openMapsWmeSdk.Events.on({ eventName: 'wme-map-zoom-changed', eventHandler: openMapsSweepHideSearchThisAreaChipAfterMapInteraction });
    }
  } catch (eSdk) { /* ignore */ }
  try {
    if (typeof W !== 'undefined' && W.map && typeof W.map.getOLMap === 'function') {
      var olm = W.map.getOLMap();
      if (olm && olm.events && typeof olm.events.register === 'function') {
        olm.events.register('moveend', olm, openMapsSweepHideSearchThisAreaChipAfterMapInteraction);
      }
    }
  } catch (eOl) { /* ignore */ }
}

function openMapsEnsureGoogleSearchThisAreaHideStyle() {
  var id = 'openmaps-style-google-search-this-area';
  var css =
    '.gm-style button[aria-label="Search this area"],' +
    '.gm-style button[aria-label="search this area"],' +
    '.gm-style [role="button"][aria-label="Search this area"],' +
    '.gm-style [role="button"][aria-label="search this area"]{display:none!important;}' +
    /* WME Places chip: CSS-module suffixes rotate; structure is stable in Chromium (:has). */
    'div[class*="container--"]:has(> div[class*="iconContainer--"] .w-icon-search):has(> div.text){display:none!important;}';
  var st = document.getElementById(id);
  if (!st) {
    st = document.createElement('style');
    st.id = id;
    try {
      document.head.appendChild(st);
    } catch (eHead) {
      return;
    }
  }
  try {
    st.textContent = css;
  } catch (eTc) { /* ignore */ }
}

function openMapsInstallHideGooglePlacesSearchThisAreaChip() {
  if (openMapsGoogleSearchThisAreaInstalled) return;
  openMapsGoogleSearchThisAreaInstalled = true;
  openMapsEnsureGoogleSearchThisAreaHideStyle();
  openMapsScheduleHideGoogleSearchThisAreaChip();
  try {
    var obs = new MutationObserver(openMapsScheduleHideGoogleSearchThisAreaChip);
    obs.observe(document.documentElement, { childList: true, subtree: true });
  } catch (eObs) { /* ignore */ }
}
//#endregion

async function onWmeReady() {
  if (typeof OpenLayers === 'undefined' || !W.map || typeof W.map.getOLMap !== 'function' || !W.map.getOLMap()) {
    openMapsOlWaitAttempts += 1;
    if (openMapsOlWaitAttempts >= OPEN_MAPS_OL_MAX_ATTEMPTS) {
      if (!openMapsOlGiveUpLogged) {
        openMapsOlGiveUpLogged = true;
        log('OpenLayers / W.map not ready after ' + OPEN_MAPS_OL_MAX_ATTEMPTS + 's; stopping retries.');
      }
      return;
    }
    setTimeout(onWmeReady, 1000);
    return;
  }
  openMapsOlWaitAttempts = 0;

  if (!openMapsWmeSdk && openMapsResolveGetWmeSdkFn()) {
    openMapsWmeSdk = openMapsGetWmeSdkOnce();
    if (openMapsWmeSdk) {
      try {
        log('WME SDK bound (SDK ' + openMapsWmeSdk.getSDKVersion() + ', WME ' + openMapsWmeSdk.getWMEVersion() + ').');
      } catch (eV) {
        log('WME SDK bound.');
      }
    } else {
      log('getWmeSdk unavailable; using legacy W.userscripts / W.map integrations.');
    }
  }

  openMapsInstallHideSearchThisAreaChipOnMapMove();

  //#endregion OpenMapsSdkBootstrap

  //#region Set up translations
  var translations = {
    en: {
      tab_title: 'Open Maps',
      maps_title: 'Active Maps',
      no_local_maps: 'No maps found for this area',
      hide_tooltips: 'Hide help',
      show_tooltips: 'Show help',
      sidebar_unlock_low_zoom: 'Unlock sidebar below zoom 12',
      sidebar_wme_lock_respect: 'Use WME low-zoom sidebar lock',
      sidebar_unlock_low_zoom_tooltip: 'Lets you use the right sidebar (layers, scripts, etc.) when zoomed out below level 12. WME normally limits interaction there. Turn off if something misbehaves after a WME update.',
      sidebar_wme_lock_respect_tooltip: 'Restore WME’s default behavior for the right sidebar when zoomed out below level 12.',
      expand: 'Click to expand',
      collapse: 'Click to collapse',
      hideshow_layer: 'Hide/Show map',
      query_window_title: 'Map Location Query',
      query_window_loading: 'Retrieving information from map service...',
      query_window_switch: 'Toggle between the processed and the original data',
      query_window_query: 'Perform this query again elsewhere on the map',
      query_empty_response: 'No response received from map service at this location. Perhaps try somewhere else or try querying another layer?',
      query_empty_response_advice: 'ℹ️ If this issue persists, you may want to check whether the page has a zoom applied to it, as this can break querying. You can press {hotkey} to reset the zoom.',
      query_table_property: 'Property',
      query_table_value: 'Value',
      retrieving_error: 'Retrieving error...',
      query_layer: 'Query a certain location of this map for more information by clicking somewhere on the map',
      external_link_tooltip: 'Show this location in this map\'s viewer',
      edit_layer: 'Edit map',
      remove_layer: 'Remove map',
      layer_out_of_range: 'Map might not display at the current zoom level',
      satellite_imagery: 'Display satellite imagery',
      select_map: 'Select a map to add',
      maps_to_add_title: 'Maps to add',
      add_maps_filter_mode_aria: 'Filter maps to add by viewport',
      add_maps_none_in_view: 'No maps cover this view. Choose All or pan the map.',
      add_map_no_matches: 'No maps match your search',
      add_map_all_added: 'All maps are already added',
      opacity_label: 'Opacity',
      opacity_label_tooltip: 'Adjust how transparent the layer is',
      transparent_label: 'Transparent',
      transparent_label_tooltip: 'Make the map background transparent',
      map_improvement_label: 'Apply pixel manipulations',
      map_improvement_label_tooltip: 'Apply pixel-level tile processing (requires redraw; may affect performance).',
      pixel_manipulations_title: 'Pixel manipulations',
      pixel_manipulations_default: 'Default',
      pixel_manipulations_override: 'Override',
      pixel_manipulations_use_default: 'Use catalog default',
      pixel_manipulations_select_none: 'Select none',
      pixel_manipulations_use_default_tooltip: 'Use catalog default (clear override)',
      pixel_manipulations_select_none_tooltip: 'Select none (override to an empty list)',
      pixel_manipulations_tooltip: 'Advanced: per-map overrides for tile pixel processing. Works independently from CSS filters and transparency. Changes apply after redraw and may cost performance.',
      map_layers_title: 'Map layers',
      find_available_layers: 'Find available layers',
      find_available_layers_loading: 'Querying server…',
      layer_catalog_loading: 'Loading layer list from server…',
      find_available_layers_loaded: 'Available layers loaded',
      find_available_layers_retry: 'Fetch failed (click to retry)',
      server_capabilities_tooltip: 'View server capabilities (cached when available)',
      server_capabilities_title: 'Server capabilities',
      server_capabilities_url_label: 'Server URL:',
      server_capabilities_error: 'Failed to reach server. Check console for details.',
      saved_layers_orphan_hint: '{n} saved layer name(s) were not found on the server and were removed.',
      saved_layers_orphan_hint_local: '{n} saved layer name(s) no longer match this map and were removed.',
      terms_section_title: 'Terms of Use',
      tou_section_status_accepted: 'Accepted',
      tou_section_status_required: 'Action required',
      tou_section_status_dismissed: 'Unverified (this session)',
      favorite_add: 'Add to favorites',
      favorite_remove: 'Remove from favorites',
      layer_group_title: 'Open Maps',
      meta_type: 'Type',
      meta_region: 'Region',
      meta_bbox: 'BBox',
      zoom_meta_band: 'Zoom band',
      zoom_meta_floor: 'Floor',
      zoom_meta_view: 'View',
      zoom_meta_tooltip: 'The zoom band is the range where this map is meant to show at full detail. “Floor” is the minimum zoom level used for tile requests when you are zoomed farther out. Beyond the band’s maximum zoom, tiles are stretched (overzoom). Outside the band or below the floor, the map may look incomplete.',
      draw_bbox_on_map: 'Draw boundary box on map',
      visual_adjustments: 'Visual adjustments',
      slider_brightness: 'Brightness',
      slider_contrast: 'Contrast',
      slider_saturation: 'Saturation',
      slider_hue_rotate: 'Hue rotate',
      slider_gamma: 'Gamma',
      blend_mode_label: 'Blend mode',
      invert_colors: 'Invert colors (dark mode)',
      reset_visual_default: 'Reset to default',
      map_options_toggle: 'Map details and layers',
      inspector_title: 'Map Inspector',
      inspector_features_grouped: 'Features by map',
      inspector_map_group_toggle: 'Expand or collapse feature rows for this map in the list (does not hide the overlay — use Active Maps)',
      inspector_sources: 'Sources',
      inspector_sources_tree: 'Layers to inspect',
      inspector_esri_viewport: 'ESRI (viewport query)',
      inspector_wms_arcgis_viewport: 'WMS (ArcGIS REST)',
      inspector_wms_wfs_viewport: 'WMS (GeoServer WFS)',
      wms_arcgis_rest_viewport_probe: 'REST viewport features (Map Inspector)',
      wms_arcgis_rest_viewport_probe_tooltip: 'When off, Map Inspector will not run ArcGIS REST /query requests for this WMS map. WMS tiles still follow Active Maps visibility and per-layer toggles. You can turn this off to save traffic while keeping the imagery on.',
      inspector_sources_all: 'All',
      inspector_sources_none: 'None',
      inspector_sources_visible: 'Visible only',
      inspector_search_placeholder: 'Filter list…',
      inspector_refresh: 'Refresh',
      inspector_list_empty: 'No features in view for the active maps.',
      inspector_list_truncated: 'List capped — zoom in for a smaller area.',
      inspector_kind_vector: 'vector',
      inspector_kind_esri: 'esri',
      inspector_kind_wms: 'wms',
      inspector_kind_wfs: 'wfs',
      inspector_kind_query: 'query',
      inspector_open_table: 'Data table',
      inspector_open_data_table: 'Open data table',
      inspector_map_row_menu: 'Map actions',
      inspector_table_title: 'Inspector data',
      inspector_table_search: 'Filter rows…',
      inspector_table_close: 'Close',
      inspector_query_ingest: 'Add query results to inspector',
      inspector_query_ingest_auto: 'Auto-add query results',
      inspector_auto_wms_gfi: 'Auto-fetch generic WMS (viewport center)',
      inspector_auto_wms_gfi_tooltip: 'Runs GetFeatureInfo at the map center when panning/zooming for WMS layers that are not served via ArcGIS REST or GeoServer WFS in this script.',
      inspector_list_empty_hint_auto: 'Use the query tool for a precise click, or zoom in.',
      inspector_list_empty_hint_manual: '(Raster maps: use query “Add to Inspector” or auto-add.)',
      inspector_scan_progress: 'Scanning… {done}/{total}',
      inspector_query_add_btn: 'Add to Inspector',
      inspector_query_add_btn_tooltip: 'Append the current query result rows to the Map Inspector list',
      inspector_bbox_layer: 'Bounds',
      inspector_clear_query_items: 'Clear imported query rows',
      inspector_not_available: 'Map Inspector is not available in this session.',
      inspector_layer_bounds: 'Bounds',
      zoom_to_map_area: 'Zoom to map area',
      visibility_locked_tou: 'Accept Terms of Use first',
      tou_config_error: 'Configuration error',
      tou_link_accepted: 'Terms of Use (accepted)',
      tou_link_dismissed: 'Terms of Use (dismissed — unverified)',
      tou_link_required: 'Terms of Use (required)',
      tou_invalid_title: 'Invalid map configuration',
      tou_invalid_body: 'This map requires a Terms of Use entry (touId) in the script, but it is missing or invalid. The map stays locked for safety. Contact the script maintainer.',
      tou_desc_accepted: 'You have accepted the terms. You can review them below:',
      tou_desc_dismissed: 'The Terms of Use page could not be verified. You dismissed the warning for this session only; the layer is unlocked but this is not recorded acceptance.',
      tou_desc_required: 'Before enabling this layer, review and accept the terms:',
      tou_read_terms_in: 'Read terms in:',
      tou_accept: 'I Accept',
      tou_unreachable_title: 'Terms of Use page could not be loaded',
      tou_unreachable_detail_suffix: ' The I Accept button stays off until the page can be verified; nothing is saved to storage.',
      tou_unreachable_hint: 'Dismiss hides this notice and unlocks the layer for this session; nothing is recorded as acceptance. Reload clears this; contact the script author if it persists.',
      tou_dismiss_session: 'Dismiss for this session',
      tou_reachable_line: 'Terms of Use page reachable — verified {when}.',
      tou_stats_accepted: 'Accepted',
      tou_stats_baseline_length: 'Baseline length',
      tou_stats_last_checked: 'Last checked',
      tou_stats_next_check: 'Next check',
      tou_stats_pending: 'Pending…',
      tou_stats_on_next_reload: 'On next reload',
      tou_stats_chars: '{n} chars',
      tou_force_check: 'Force check now',
      tou_checking_url: 'Checking live URL…',
      tou_baseline_saved: 'Baseline saved!',
      tou_unchanged: 'Unchanged ({variance})',
      tou_revoked: 'WME Open Maps:\n\nTerms of Use have changed by {percent}%!\n\nConsent has been revoked. Please read and re-accept.',
      notice_dismiss: 'Dismiss',
      tou_gate_banner: '"{title}" was added. Expand its row and accept Terms of Use before turning it on.',
      add_map_pick_hint: 'Open the list or type to filter maps.',
      user_maps_section_title: 'Your maps',
      user_maps_add_placeholder: 'Paste My Maps link (Edit, Preview, or Share)…',
      user_maps_add_button: 'Add',
      user_maps_default_title: 'Google My Map',
      user_maps_add_invalid: 'No map id found. Paste the full browser address from Google My Maps while editing or viewing your map (it must contain mid=…). You do not need a separate “KML link”.',
      user_maps_add_duplicate: 'That My Map is already in your list.',
      user_maps_add_error_network: 'Could not download map data. Check the link and try again.',
      user_maps_add_error_parse: 'Could not parse KML. The map may use features this editor cannot read yet.',
      user_maps_kml_unsupported: 'This WME build has no KML parser (OpenLayers.Format.KML).',
      user_maps_hint: 'Use the same URL you see in the address bar on google.com/maps/d/… (e.g. …/edit?mid=… or …/viewer?mid=…). OpenMaps loads the map geometry from Google automatically. Accept Google’s terms in map details before enabling.',
      active_maps_filter_placeholder: 'Filter active maps…',
      active_maps_filter_all: 'All',
      active_maps_filter_favorites: 'Favorites',
      active_maps_filter_in_view: 'In view',
      active_maps_filter_visible: 'Visible',
      active_maps_filter_tou_pending: 'ToU pending',
      active_maps_filter_no_match: 'No maps match these filters.',
      active_maps_filter_mode_aria: 'Filter active maps list',
      reset_terms_button: 'Revoke all map terms (reload)',
      reset_terms_confirm: 'Revoke all saved Terms of Use? Affected maps stay locked until you accept again. The page will reload.',
      query_window_close: 'Close query results',
      query_window_minimize: 'Minimize or restore panel height',
      query_results_for: 'Query results: {title}',
      tou_gate_add_alert: 'Open Maps — Terms of Use\n\n"{title}" requires you to review and accept its terms in the Open Maps sidebar before it can turn on. Expand this map (chevron), open Terms of Use, follow the legal links, then tap I Accept.\n\nThis is normal; the script is working.',
      tou_pending_hint: 'Terms of Use acceptance required',
      no_layers_enabled_hint: 'No map layers are enabled. Open map options and turn on at least one layer.',
      layer_origin_curated: 'Curated in script',
      layer_origin_cloud: 'From server catalog (cloud)',
      layer_origin_unknown: 'Not in script or server catalog',
      layer_origin_default: 'Default layer',
      copy_map_definition_tooltip: 'Copy map definition',
      copy_map_definition_menu_all_keep_defaults: 'Copy (All layers, keep defaults)',
      copy_map_definition_menu_all_make_enabled_default: 'Copy (All layers, make enabled layers default)',
      copy_map_definition_menu_enabled_only_make_default: 'Copy (Enabled layers only, make them default)',
      copy_done: 'Copied',
      tou_link_probe_checking: 'Checking whether the Terms of Use page can be reached…',
      tou_link_probe_ok: 'Terms of Use page is reachable — verified {when}.',
      tou_link_probe_fail: 'Terms of Use page could not be loaded ({detail}).',
      tou_accept_disabled_tooltip: 'Open every language link above first to enable.',
      errors: {
        network: 'Network error',
        network_description: 'Received the following status code when retrieving information: ',
        see_console: 'See web console for more details',
        timeout: 'Timeout',
        timeout_description: 'Retrieving response took more than 10s, probably network issue',
        parse_fail: 'Could not parse error message'
      },
      areas: {
        AL: 'Albania',
        BE: 'Belgium',
        BR: 'Brazil',
        LU: 'Luxembourg',
        NL: 'The Netherlands',
        OM: 'Oman',
        US: 'United States',
        HR: 'Croatia',
        CZ: 'Czech Republic',
        UN: 'Universal',
        EU: 'European Union',
        user: 'Your maps'
      },
      update: {
        message: 'WME Open Maps has been updated! Changelog:',
        v2_3_0: 'Complete rework of the userscript\n- Display multiple maps at the same time\n- Make it possible to query map layers',
        v2_3_1: '- Fixes loading and saving of map state\n- Fixed some bugs concerning map ordering\n- Gray background added to map loading indicator\n- Adjusted BAG map queryability',
        v2_3_2: '- Fixes bug where removing a map also internally removed the maps below\n- Layer querying will only now only take place on visible queryable layers\n- Small changes to boundary and querying options in some maps',
        v2_3_3: '- Fixes to map layer reordering',
        v2_3_4: '- Small UI improvements and internal code refactoring',
        v2_3_5: '- Slightly improved map query response handling\n- Fixed TamperMonkey notices about accessing external resources',
        v2_3_6: '- Fix behaviour on WME beta\n- Group maps by country\n- Add Hectopunten map for The Netherlands',
        v2_3_7: '- Fixed map layer sorting\n- Defunct layer cleanup\n- Add Wegenregister map for Belgium',
        v2_3_8: '- Added indication for unsupported zoom levels\n- Added new layer to the PDOK map in the Netherlands',
        v2_3_9: '- Support new URL for WME beta',
        v2_3_10: '- Updated layers for GBO Provincies satellite imagery',
        v2_3_11: '- Bug fix for WME beta that caused the script to halt\n(layer drawer will be adjusted later on)',
        v2_4_0: '- Support new layer drawer\n- Updated Orthomozaïek Vl. Tijdsreeksen to default to 2016\n- Added map with administrative borders for Flanders',
        v2_5_0: '- Restyling and rework of query result window\n- Several layer preference and location fixes',
        v2_5_1: '- Allow minimizing of query result window\n- You can now see the original data as well',
        v2_5_2: '- Queries can now be repeated from their results window\n- Query results ordering has been improved\n- Query results display better within house number editing mode',
        v2_6_0: '- Added basic map for Rio de Janeiro\n- Improved translations while adding support for Portuguese',
        v2_6_1: '- Fixed PICC map as some road layers were renamed',
        v2_6_2: '- Added new satellite source for Flanders, Belgium',
        v2_7_0: '- Improve UI in various locations\n- Provide links to external map viewers\n- Allow hiding of help messages',
        v2_7_1: '- Bugfix: tooltips hiding edge case solved\n- Bugfix: Wrong indication of missing map data at certain zoom levels',
        v2_7_2: '- Fix text overflow in layer menu\n- Fix script activation on missing trailing slash in URL\n- Changed map query icon to pointing hand',
        v2_7_3: '- Internal fix for beta (hasUser function was removed)',
        v2_7_4: '- Recover from changing distance unit\n- Updated Orthofotomozaïek Tijdsreeksen map (Belgium)',
        v2_7_5: '- Added new CRAB Adrespunten map\n- Fixed tooltips being partially covered in new layout\n- Attempt at fixing maps invisible at zoom 100%\n- Recover layers menu when using the events mode',
        v2_7_6: '- Fix BAG map constraints\n- Fix opacity slider that was stuck at 100%',
        v2_7_7: '- Fix an internal issue that would otherwise pop up in two months',
        v2_8_0: '- Adjust query window location\n- Replace GBO Provincies map with PDOK\n- Remove unsafeWindow code',
        v2_8_1: '- Fixed Hectopunten map (NL)\n- Added Kadastrale Kaart (NL)\n- Removed deprecated BGT map (NL)',
        v2_8_2: '- Added Ortho Vl. 2013-2015 Grootschalig (BE)\n- Added Snelheidsregimes en referentiepunten AWV (BE)',
        v2_8_3: '- Removed Waze April Fools button\n- Added N23 Westfrisiaweg map (NL)',
        v2_8_4: '- Added Administrative Borders Map (BE)',
        v2_8_5: '- Updated CIRB map (BE)',
        v2_8_6: '- Added GIPOD Actueel (BE)',
        v2_8_7: '- Updated Orthomozaïek Vlaanderen (BE)',
        v2_8_8: '- Added Orthophotos 2016 and Réseau routier régional (BE)',
        v3_0_0: '- Added support for new map types\n- Adjusted to new layer menu layout',
        v3_0_1: '- Revert BAG map (NL)',
        v3_0_2: '- Reverted release 3.0 as there were too many breaking bugs',
        v3_0_3: '- Adjusted to new layer menu layout\n- Allow proper removal of broken map layers',
        v3_0_4: '- Fixes for recent WME update\n- Fixed map loading progress bar',
        v3_0_5: '- Added West Virginia Leaves Off map (US)\n- Added Maximumsnelheden map (NL)',
        v3_0_6: '- Added Verkeersborden en Afgeleide Snelheidslimieten maps (BE)\n- Fixed Snelheidsregimes en referentiepunten AWV (BE)',
        v3_0_7: '- Several UI fixes\n- Updated West Virginia Leaves Off map (US)',
        v3_1_0: '- Added Oman map\n- Added various graphical improvements\n- Improved layout\n- Updated/fixed various other maps',
        v3_1_1: '- Hide blank map tiles\n- Various minor layout changes and bugfixes',
        v3_1_2: '- Small performance improvements',
        v3_1_3: '- Added a couple of maps for Brussels (BE)',
        v3_1_4: '- Added traffic signs map for Flanders (BE)',
        v3_1_5: '- Enabled some extra layers by default for Wegenregister map (BE)\n- Improvements for latest WME version',
        v3_1_6: '- Upgrade BAG map and fix Kadastrale kaart map (NL)',
        v3_1_7: '- Added USDA NAIP map',
        v3_1_8: '- Corrected WV Leaves Off layers and added transparency to WV Leaves Off\n- Added more recent Orthophoto maps for Wallonia (BE)',
        v3_1_9: '- WV Leaves Off layers updated\n- Renamed some layers for Brussels',
        v3_1_10: '- WV Leaves Off layers updated\n- Fixed several Brussels maps',
        v3_1_11: '- Added Cadastral Borders map (BE)',
        v3_1_12: '- Added aerial imagery of Virginia (US)\n- Updated PICC and Brussels Future speed limits maps (BE)\n- Updated Oman National Basemap maps',
        v3_1_13: '- Added aerial imagery of Tennessee (US)',
        v3_1_14: '- WV Leaves Off layers updated (US)',
        v3_1_15: '- Fix for upcoming WME version',
        v3_1_16: '- Move Virginia map to new hosting location (US)',
        v3_1_17: '- Added aerial imagery of Pennsylvania (US)\n- Tennessee map bounding box correction (US)',
        v3_1_18: '- Added NAIP+ imagery for US territories, Alaska, and Hawaii\n- Added gray pixel tracing for Oman maps',
        v3_1_19: '- Fixed Luchtfoto (NL) by using PDOK directly',
        v3_1_20: '- Adjustments for WME v2.83',
        v3_1_21: '- Updated BAG (NL)\n- Updated luchtfoto (NL)',
        v3_1_22: '- WV Leaves Off layers updated (US)',
        v3_1_23: '- Updated for new WME layout',
        v3_1_24: '- Added North Carolina NC One Map (US)',
        v3_1_25: '- Migrated Flanders map services to new endpoint (BE)\n- Updated PDOK Luchtbeelden (NL)',
        v3_1_26: '- Updated for new WME version',
        v3_2_1: '- Adjust layout for new WME',
        v3_2_2: '- WV Leaves Off layers updated (US)',
        v3_2_3: '- Migrate Maximumsnelheden map (NL)',
        v3_2_4: '- Replace NAIP with NAIP+ map (US)',
        v3_2_5: '- Migrate to new Waze API for creating tabs',
        v3_2_6: '- WV Leaves Off layers updated (US)',
        v3_2_7: '- PICC map layers updated (BE)',
        v3_2_8: '- WV Leaves Off layers updated (US)',
        v3_2_9: '- Cadastral borders map replaced (BE)',
        v3_2_10: '- Fixed spacing issue in query window results\n- Added VLAIO map (BE)',
        v3_2_11: '- Added Publieke oplaadpunten map (BE)',
        v3_2_12: '- Take into account the Additional imagery map layers',
        v3_2_13: '- Replace Adrespunten map with Adressenregister (BE)\n- Fix Maximumsnelheden query results (NL)',
        v3_2_14: '- Fix Nationaal Wegen Bestand map and removed duplicate Hectopunten map (NL)',
        v3_2_15: '- Migrate GIPOD to new endpoint with extra map layers (BE)',
        v3_2_16: '- Block duplicate map adding (to be supported in the future)\n- Migrate and update Weggegevens and Kadastrale Kaart map layers (NL)',
        v3_2_17: '- Added maps for Croatia (HR)',
        v3_2_18: '- Fix Brussels Ortho map location (BE)',
        v3_2_19: '- Prepare for changes in WME beta',
        v3_2_20: '- Fix map retrieval breakage due to unexpected changes',
        v3_2_21: '- Fix WV Leaves off and USGS NAIP+ layers (US)',
        v3_2_22: '- Added IndianaMap (US)',
        v3_2_23: '- Fix Virginia Aerial Imagery map (US)\n- Added advice on what to do if querying never gives a result.',
        v3_2_24: '- WV Leaves Off layers updated (US)',
        v3_2_25: '- IndianaMap updated (US)',
        v3_2_26: '- IndianaMap updated (US)\n- WV Leaves Off layers updated (US)',
        v3_2_27: '- Updated Yearly Orthomaps (BE and NL)',
        v3_2_28: '- Fixed CIRB map (BE)',
        v3_2_29: '- Added Maryland iMAP (US)',
        v3_2_30: '- Added Luxembourg maps (LU)',
        v3_2_31: '- Fixed Brussels maps (BE)',
        v3_2_32: '- WV Leaves Off layers updated (US)',
        v3_2_33: '- Fixed Luchtfoto 2025 map layers (NL)',
        v3_2_34: '- Fixed broken map layer reordering',
        v3_2_35: '- WV Leaves Off layers updated (US)',
        v3_2_36: '- Add Orthophotos 2024 map (BE)\n- Limit default BAG objects shown (NL)',
        v3_2_37: '- Added ČÚZK (Czech Republic) WMS maps (CZ)',
        v3_2_38: '- Migrate ČÚZK WMS to ags.cuzk.gov.cz (ortofoto, GeoNames, ZABAGED polohopis); add Přehledová mapa overview (CZ)',
        v2026_03_29_05: '- Fix crash when the server layer list finished loading while all WMS sub-layers were hidden',
        v2026_03_31_01: '- Map details: quiet zoom line (band, optional WMS floor, current view) with a short help tooltip; no extra map listeners',
        v2026_03_31_02: '- Map Inspector: viewport list of in-memory vector features (capped), details, highlight/zoom, data table, optional query-result import',
        v2026_03_31_03: '- Map Inspector: ESRI MapServer viewport query (auto list), layer tree, compact icon UI, hover highlight',
        v2026_03_31_04: '- Map Inspector: minimal chrome (native icon buttons), WMS viewport via ArcGIS REST / GeoServer WFS',
        v2026_04_01_01: '- Reduce browser tile load pressure: no global OpenLayers image reload retries; overlay layers use buffer 0 and no resize transition (helps net::ERR_INSUFFICIENT_RESOURCES with many maps active)',
        v2026_04_01_02: '- Map Inspector: automatic WMS GetFeatureInfo at viewport center for generic queryable layers (optional setting); shared HTML table parsing with query import',
        v2026_04_01_03: '- Map Inspector: show scanning progress (spinner, done/total) while viewport remote requests run; refresh icon spins until complete',
        v2026_04_01_04: '- Map Inspector: remove in-panel Details block and redundant zoom/highlight buttons (selection, map highlight, and callout unchanged)',
        v2026_04_01_05: '- Map Inspector: denser feature list (smaller type, padding, gaps; taller scroll area) so about twice as many rows fit vertically',
        v2026_04_01_06: '- Map Inspector: snappier map hover highlight when moving between list rows (skip redundant leave/enter OpenLayers updates; coalesce to one draw per animation frame)',
        v2026_04_01_07: '- Map Inspector: cap concurrent viewport layer requests (queue) and track completed count so progress does not stick at 0/N when many maps fire at once; shorter per-request timeout',
        v2026_04_01_08: '- Map Inspector: ESRI MapServer, ArcGIS REST WMS, and GeoServer WFS viewport fetches now all run through the same bounded queue so progress advances reliably',
        v2026_04_01_09: '- Optional workaround when WME limits the right sidebar below zoom 12: on by default (pointer-events + inert); turn off in the Open Maps footer if you prefer stock WME behavior',
        v2026_04_01_10: '- Catalog: ArcGIS Online World Heritage Sites FeatureServer (points) with Map Viewer link (distinct from UNESCO Sites Navigator layer)',
        v2026_04_01_11: '- Catalog: ArcGIS Online World_Heritage_UNESCO FeatureServer (points) with Map Viewer link (separate from World_Heritage_Sites and UNESCO/ Sites Navigator services)',
        v2026_04_01_13: '- ESRI_FEATURE (ArcGIS FeatureServer vectors): fix geometry parsing (shared openMapsEsriGeometryToOpenLayers) and drop stale out-of-order query results when panning',
        v2026_04_01_14: '- Map Inspector: group checkbox toggles overlay visibility like Active Maps eye; per-map row count; map actions ⋮ menu (Open data table first); skip full viewport rescan when view bucket unchanged (Refresh forces); callout stays open on map pan; callout width 110% of inspector panel; removed low-zoom sidebar unlock workaround',
        v2026_04_02_01: '- Edit panel: show Map Inspector backend tag for WMS URLs (ArcGIS REST vs GeoServer WFS) so editors understand which viewport requests will run.',
        v2026_04_02_02: '- Edit panel: make the WMS inspector-backend indicator compact (append an “ArcGIS REST” / “GeoServer” chip right after Type; no extra label).',
        v2026_04_02_03: '- ESRI_FEATURE (ArcGIS FeatureServer): point markers match sidebar avatar color and scale (130% of 32px avatar), white outline and soft shadow; hover/inspector highlight uses a larger semi-transparent white halo.',
        v2026_04_02_04: '- ESRI_FEATURE: draw points with native OpenLayers circles (WME often skips data-URL externalGraphics); stack FeatureServer vector layers above WME POI overlays so markers are visible; keep Map Inspector highlight on top.',
        v2026_04_02_05: '- ESRI_FEATURE: symbol size is 130% of the Map Inspector list avatar (16px); canvas point icons with shadow; two-part highlight (translucent halo under marker, solid white ring on top); map hover highlights features.',
        v2026_04_02_06: '- ESRI_FEATURE: always draw points as native OpenLayers circles again (WME does not reliably paint canvas data-URL externalGraphics, which left markers invisible when the icon was “successfully” generated).',
        v2026_04_02_07: '- ESRI_FEATURE: thinner white rim; stronger highlight halo; map hover always updates highlight (even before inspector list refresh); highlighted point drawn on a lift layer above other FeatureServer points; clicking a point opens Map Inspector if needed and selects like the list.',
        v2026_04_02_08: '- ESRI_FEATURE: remove lift-layer + hidden-source hack (markers could stay invisible after un-hover); draw-order bump keeps the highlighted point on top; stronger white halo fill.',
        v2026_04_02_09: '- ESRI_FEATURE: highlight halo ~95% opaque; halo under active symbol only, active FeatureServer layer above other ESRI layers while highlighted; map hover uses pixel-radius fallback for small points.',
        v2026_04_02_10: '- Map Inspector: separate hover vs selection highlights on the map and in the list (both can show at once; selection stacks above hover; each ESRI point gets its own halo under that symbol).',
        v2026_04_02_11: '- Map Inspector: ESRI halos stay under symbols (z-order when two FeatureServer layers highlight); white hover ring (no blue outline); halos only with active hover/selection; closing the map callout clears selection.',
        v2026_04_02_12: '- Map Inspector: force halo layers below FeatureServer source after reorder; map click dismisses feature callout (remove erroneous skip on olMap.div).',
        v2026_04_02_13: '- Map Inspector: resync in-memory vector feature refs after pan / ESRI_FEATURE layer refresh so selection highlight stays on the symbol.',
        v2026_04_02_14: '- Map Inspector: dismiss map callout on click-outside only; map pan/drag no longer closes it (pointer drag threshold).',
        v2026_04_03_01: '- Map Inspector: feature callout stays open while panning (OpenLayers move cancels dismiss); inspector window can be dragged partly off-screen; only the feature list scrolls (no whole-window vertical bar); list has no horizontal scrollbar.',
        v2026_04_03_02: '- Map Inspector: restore visible feature list (flex list no longer collapses to zero height; minimize restores body as flex column).',
        v2026_04_03_03: '- Map Inspector: selected ESRI_FEATURE layer is always raised above other FeatureServer overlays (fix early-exit when halo layer is not yet on the OL map list).',
        v2026_04_03_04: '- Map Inspector: ESRI_FEATURE z-pin works even when handle layer ref !== feature ref (match by layer name); always track select/hover source for any ESRI avatar layer geometry (not only Point); raise vector layer even if bbox handle is missing.',
        v2026_04_03_05: '- Map Inspector: do not reorder whole ESRI_FEATURE map layers on hover/select; draw temporary cloned point symbols on lift layers above overlays (rings/halos unchanged).',
        v2026_04_03_06: '- Map Inspector: WMS/WFS/remote-query geometries (geometry-only rows) use the same avatar-colored lift/halo/ring points and ESRI-style line/polygon highlights as ESRI_FEATURE.',
        v2026_04_03_07: '- Map Inspector: geometry-only rows (WMS/WFS/query) always show avatar-colored symbols on the map while the inspector is open, not only on list hover or selection.',
        v2026_04_03_08: '- Map Inspector: map hover and click work on persistent WMS/WFS/query symbols (same hit-testing path as ESRI_FEATURE vectors).',
        v2026_04_03_09: '- Map Inspector: document capture-phase map click runs before WME Places/POI overlays can steal the event, so inspector symbols and ESRI_FEATURE points stay selectable when Places is on.',
        v2026_04_03_10: '- Map Inspector: inspector highlights, viewport-geometry symbols, and ESRI_FEATURE layers are pinned together at the top of the OpenLayers stack (after WME adds Places); re-pin on addlayer so symbols stay visible above Places.',
        v2026_04_03_11: '- Map Inspector: set high CSS z-index on OpenMaps/inspector/ESRI_FEATURE layer divs so WME Places semi-transparent vectors do not paint above our symbols (OL index alone is not enough in some WME builds).',
        v2026_04_03_12: '- Map Inspector / Places: raise overlay z-index base (~2^31 range) so **all** ESRI_FEATURE symbols (not only inspector lift/highlight) stay above Places; re-pin overlay stack after FeatureServer features load.',
        v2026_04_03_13: '- Map Inspector: feature detail callout text is selectable and copyable (override map canvas user-select).',
        v2026_04_03_14: '- Map Inspector / Places: assign overlay layer `z-index` from **2147483647 downward** (one step per layer) so the **backmost** pinned layer (default ESRI_FEATURE symbols) is not stuck at “base+1” in a band WME Places can paint inside; mirror `z-index` on canvas/SVG under the layer div with `!important`.',
        v2026_04_03_15: '- Map Inspector / Places: resolve OpenLayers layers by **`layer.name`** when `olMap.layers.indexOf(handleLayer)` is −1 (WME sometimes wraps or replaces the instance). Pinning and CSS `z-index` now target the **live** map layer so ESRI_FEATURE draw order and div styling actually apply.',
        v2026_04_03_16: '- Map Inspector / Places: ESRI_FEATURE vector layers use a **unique** OpenLayers `layer.name` per map row (`OpenMaps_ESRI_FEATURE_` + map id) and `openMapsMapId` for resolution. Duplicate map titles no longer make `openMapsResolveLayerOnOlMap` match the wrong layer, so idle FeatureServer symbols get the same high `z-index` as inspector overlays (above WME Places).',
        v2026_04_03_17: '- Map Inspector / Places: OpenLayers **`layer.setZIndex`** assigns `div.style.zIndex` without `!important`, which **overwrites** our pinned overlay `z-index` after `resetLayersZIndex` / redraw (idle ESRI symbols fell under Places while inspector layers looked fine). Hook **`OpenLayers.Layer.prototype.setZIndex`** and **`map.resetLayersZIndex`** to re-apply overlay `!important` values immediately after OL resets stacking.',
        v2026_04_03_18: '- Map Inspector / Places: overlay `z-index` is now enforced with **`!important` rules in an injected stylesheet** (`.openmaps-ol-overlay-z[data-openmaps-ol-ztok]`), not only inline styles. OpenLayers can still assign plain inline `z-index`; author **`!important` in a stylesheet beats non-important inline**, so idle ESRI_FEATURE symbols stay above WME Places. Also hook **`OpenLayers.Map.prototype.resetLayersZIndex`** (not only the live map instance) and only reapply when the map is **`W.map.getOLMap()`** so other OpenLayers maps on the page cannot corrupt the rule set.',
        v2026_04_03_19: '- Map Inspector / Places: **pin and CSS z-index now target only layers that actually live on `olMap.layers`**, then **sweep** for any `OpenMaps_ESRI_FEATURE_*` vector still registered on the map. Previously, falling back to the handle’s layer when `indexOf` was −1 meant **`setLayerIndex` was skipped** and stylesheet tokens could attach to a **stale/detached `div`** while idle symbols drew on WME’s replacement layer — so highlights (same live refs) looked fine but default markers stayed under Places. **Google Places** is a native layer WME already stacks above venue fills; it was a useful control, not the root cause.',
        v2026_04_03_20: '- Map Inspector / Places: **hover/click map-id** for ESRI_FEATURE no longer uses `h.layer === hit.layer` (fails when WME replaces the OL instance). Uses `openMapsMapId` / `OpenMaps_ESRI_FEATURE_<id>` / `openMapsResolveLayerOnOlMap` so overlapping maps do not thrash highlights. **Swept** overlay layers are sorted by **Active Maps (handles) order** so `setLayerIndex` does not reshuffle FeatureServer stacks each pin. **Hoist** OpenMaps overlay `div`s to the end of `map.viewPortDiv` when they are direct children (paint order tie-break). Overlay CSS selectors are prefixed with **`#<olMap.div.id>`** when present for higher specificity vs WME. **`moveend`** debounces a re-pin after pan.',
        v2026_04_03_21: '- Map Inspector / Places: pinned overlay vector `div`s / `canvas` / `svg` use **`pointer-events: none !important`**. They were painted above WME Places but still **captured the DOM hit target**, so Places never received clicks (sibling layers do not see bubbling from another branch). ESRI picks still use **document capture** + map-pixel hit-testing (`trySelectEsriFeatureFromClick`); OpenLayers `mousemove` still runs on the map. Fixes Places staying unselectable until pan after pointer left the map / z-order fights.',
        v2026_04_03_22: '- **WME SDK-first integration:** `getWmeSdk` (GreasyFork script id `570591`), bounded wait for OpenLayers/W.map (~90s) with a one-shot failure log, `Sidebar.registerScriptTab` with legacy `W.userscripts` fallback, map view updates via `Events` (`wme-map-move-end` / `wme-map-zoom-changed`) with `moveend` fallback, satellite imagery via `Map.isLayerVisible` / `setLayerVisibility` + `trackLayerEvents` when available, tooltips via Bootstrap 5 `Tooltip` (no jQuery). OpenLayers prototype z-index hooks and `unsafeWindow`+`GM_xmlhttpRequest` remain documented polyfills for CSP/sandbox and OL stacking.',
        v2026_04_03_23: '- **Maintenance:** Region map comment after the script header; `//#region OpenMapsSdkBootstrap` (SDK helpers + OpenLayers wait + `onWmeReady` prefix through SDK bind) and `//#region OpenMapsBoot` (`onWmeInitialized`, `bootstrap`, entry call) for editor navigation—no runtime behavior change.',
        v2026_04_03_24: '- **UI:** Hide Google Maps’ native “Search this area” chip on the map (WME Places / Google base map). It is not from OpenMaps; CSS plus a small DOM sweep covers common editor locales.',
        v2026_04_03_25: '- **UI:** “Search this area” is WME’s React pill (`container--*`, `.w-icon-search`, `div.text`), not `.gm-style`. Hide it with `:has(...)` CSS and a `div.text` sweep; keep legacy Google control hiding.',
        v2026_04_03_26: '- **Map Inspector:** Per-map list checkbox only expands or collapses rows under that map; it no longer calls Active Maps visibility (sidebar eye still controls the overlay).',
        v2026_04_03_27: '- **UI:** “Search this area” chip: run hide sweep **immediately** on DOM mutations (not only after 80 ms), plus coalesced `requestAnimationFrame` passes and a final timeout; also sweep after **`wme-map-move-end`**, **`wme-map-zoom-changed`**, and OpenLayers **`moveend`** so the pill does not flash on the first pan after reload.',
        v2026_04_03_28: '- **WMS (ArcGIS REST):** Map options include a checkbox to enable or disable REST viewport feature queries for Map Inspector independently of WMS tile visibility (tiles still use Active Maps + layer toggles).',
        v2026_04_03_29: '- **ESRI_FEATURE:** Map options no longer show WMS-only “transparent background”, CSS visual filters, or pixel manipulations (they do not apply to FeatureServer vectors and could call `mergeNewParams` on a vector layer). Later builds also drop the opacity control for vectors and hide the bbox toggle for Universal (UN) maps.',
        v2026_04_03_30: '- **Universal (region UN):** No “draw boundary box” option; bbox overlay stays off. **ESRI_FEATURE:** Opacity slider removed; vector layer always renders at full opacity (saved opacity is ignored for that type).',
        v2026_04_03_31: '- **Fix:** Universal (UN) maps no longer show the bbox checkbox or an empty “Visual adjustments” block; ESRI_FEATURE maps no longer show the opacity slider there (engine already keeps vectors at full opacity).',
        v2026_04_03_32: '- **Your maps:** Add **Google My Maps** by pasting a share/embed link or map id; KML is fetched (Tampermonkey) and drawn as a vector overlay. Entries persist in settings; accept **Google** terms per map. Same storage is intended for custom WMS / ArcGIS / XYZ later.',
        v2026_04_03_33: '- **Your maps:** Clearer copy (no need to find a “KML link”); **edit / viewer / share** My Maps URLs with `mid=` are parsed via `URL` + hash fallback. Trim stray quotes/punctuation from pasted links.',
        v2026_04_03_34: '- **Fix (satellite / My Maps):** Google My Maps and ESRI_FEATURE vectors are only **stack-pinned** (OpenLayers index + overlay z-index) when the row is active and the layer is visible. Hidden or out-of-area maps no longer re-enter the stack via the layer sweep. **Pan/zoom** re-pin is **debounced** (~220 ms) so WME satellite tiles are not disrupted by constant reordering. Overlay z-index rules clear when nothing needs pinning. **Aerial floor** for tile overlays also matches the `satellite_imagery` layer name if `earthengine-legacy` is absent.',
        v2026_04_03_35: '- **Fix (satellite / My Maps):** Google My Maps KML vectors are **no longer** included in the ESRI-style overlay pin (top-of-`olMap` + `!important` z-index + viewport `div` hoist). They are ordered only via **`syncOpenMapsLayerIndices`** above aerial imagery, like tile overlays. The aggressive pin stack was still breaking WME satellite tile loading when My Maps was the only active layer.',
        v2026_04_03_36: '- **Fix (satellite / My Maps):** **`syncOpenMapsLayerIndices`** no longer calls **`setLayerIndex`** on a My Map row while it is **hidden**, **out of area**, or the OL layer is **not visible** (the vector stayed on the map and was still reordered). **Layer-index math** uses only “participating” handles so slots stay correct. The global **`setZIndex` / `resetLayersZIndex`** reapply path runs only when an **ESRI_FEATURE** overlay pin or **Map Inspector** overlay stack actually needs it, so satellite and other WME layers are not dragged through overlay CSS work on every pan/zoom when only a (hidden) My Map is in Active Maps.',
        v2026_04_03_37: '- **Fix (satellite / My Maps):** **`syncOpenMapsLayerIndices` no longer installs** the global OpenLayers **`Layer.setZIndex`** / **`Map.resetLayersZIndex`** hooks on every sync. Those hooks were still attached as soon as any OpenMaps row existed (e.g. hidden My Map), so **every** WME layer (including satellite) kept going through our wrapper. Hooks and **`moveend` re-pin** are installed only when **`openMapsOverlayPinStackHasWork()`** (ESRI_FEATURE pin or Map Inspector overlays). **`pinOpenMapsOverlayStackTop`** installs the same hooks the first time it actually pins a non-empty overlay stack.',
        v2026_04_03_38: '- **Fix (satellite / My Maps):** Hidden/out-of-area Google My Maps layers are now **detached from `W.map` / `olMap`** (removed, not only `setVisibility(false)`), so merely having a My Map row in Active Maps cannot affect OpenLayers layer ordering or satellite tile flow. The layer is rebuilt only when the row becomes visible again.',
        v2026_04_03_39: '- **Hotfix:** Roll back the v2026.04.03.38 My Maps detach path to restore startup stability. Keep v2026.04.03.37 behavior (no global OL hook install from `syncOpenMapsLayerIndices`; no ESRI-style pin for My Maps).',
        v2026_04_03_40: '- **Hotfix rollback:** Step back one more level to the **v2026.04.03.36 runtime path** (restore hook/`moveend` registration flow from before v37) to recover script startup while satellite/My Maps debugging continues.',
        v2026_04_03_41: '- **Startup fix:** Some bridge/Tampermonkey environments fire `wme-initialized` but never emit `wme-ready`. OpenMaps now keeps the normal `wme-ready` listener **and** starts a guarded fallback timer (single-shot launch) so startup cannot stall at “waiting for wme-ready signal…”.',
        v2026_04_03_42: '- **Fix (satellite / My Maps):** Google My Maps vectors are **excluded from `syncOpenMapsLayerIndices` `setLayerIndex` entirely** (not only when hidden). Visible KML layers were still reordered above aerial on every sync/KML refresh, which could stop WME satellite tiles after pan/zoom. My Maps stays at WME/OpenLayers default stack position; tile/WMS/ESRI overlays still sync above aerial as before.',
        v2026_04_04_01: '- **Fix (satellite / My Maps):** **`syncOpenMapsLayerIndices` no longer installs** global OpenLayers **`Layer.setZIndex`** / **`Map.resetLayersZIndex`** hooks every run (the v40 rollback had restored that). Satellite and other WME layers were still wrapped whenever any OpenMaps row existed. Hooks attach when **`pinOpenMapsOverlayStackTop`** pins a non-empty ESRI/inspector stack; **`addlayer` / debounced `moveend`** listeners register only when **`openMapsOverlayPinStackHasWork()`**. **`minForeignAbove`** now scans **`olMap.layers`** using **resolved OpenLayers layer refs** so My Maps vectors are not treated as foreign WME layers when `W.map.getLayers()` returns different object identities than `handles[].layer`.',
        v2026_04_04_02: '- **Fix (satellite / My Maps):** Tile stacking now uses **`olMap.getLayerIndex`** for both the **aerial floor** and **`minForeignAbove`** (never mixed array loop index with `W.map.getLayerIndex`). When those numbers diverged, OpenMaps could pack tile layers into invalid slots and disturb Earth Engine / satellite tiling. **Google My Maps** vectors are **`removeLayer`’d** from `W.map`/`olMap` whenever the row is off (hidden, no sub-layer, out of area, or ToU not accepted)—not only `setVisibility(false)`—then re-added when shown. **KML load** no longer calls **`syncOpenMapsLayerIndices`** after every fetch.',
        v2026_04_04_04: '- **Fix (satellite / My Maps):** WME roads and satellite maps turning blank shortly after a My Map loads is a classic **WebGL context loss** (Waze’s native map renderer crashes when the browser is overwhelmed). OpenMaps now **bypasses WME’s `W.map.addLayer` wrapper entirely** for heavy vector layers (My Maps / ESRI_FEATURE), adding them directly to the underlying OpenLayers engine. This stops WME’s React state from tracking thousands of foreign vectors. KML now requests **`Canvas` rendering** before falling back to SVG, and restricts loading to **1500** features maximum to protect WME memory limits.',
        v2026_04_04_06: '- **Fix (satellite bug #3):** Decoupled `visibilitychanged` and `moveend` event registrations from the standard tile layer lifecycle to ensure Google My Maps instances do not accidentally trip WME map interactions while detached.'
      }
    },
    nl: {
      tab_title: 'Open Maps',
      maps_title: 'Actieve kaarten',
      no_local_maps: 'Geen lokale kaarten gevonden',
      map_already_selected: 'Deze kaart is al toegevoegd',
      hide_tooltips: 'Hulp verbergen',
      show_tooltips: 'Hulp weergeven',
      sidebar_unlock_low_zoom: 'Zijbalk vrij onder zoom 12',
      sidebar_wme_lock_respect: 'WME-vergrendeling onder z12',
      sidebar_unlock_low_zoom_tooltip: 'Maakt de rechterzijbalk (lagen, scripts, …) bruikbaar als je verder bent uitgezoomd dan niveau 12. WME beperkt dat normaal. Zet uit als iets raar doet na een WME-update.',
      sidebar_wme_lock_respect_tooltip: 'Herstelt het standaard WME-gedrag voor de rechterzijbalk onder zoomniveau 12.',
      expand: 'Klik om uit te breiden',
      collapse: 'Klik om te verbergen',
      hideshow_layer: 'Verberg/Toon kaart',
      query_window_title: 'Kaartlocatie doorzoeken',
      query_window_loading: 'Informatie aan het opvragen bij kaartdienst...',
      query_window_switch: 'Wissel tussen de verwerkte en onbewerkte gegevens',
      query_window_query: 'Voeg deze opvraging elders op de kaart opnieuw uit',
      query_empty_response: 'Geen antwoord ontvangen van de kaartdienst op deze locatie. Misschien kan je een andere locatie proberen of een andere laag bevragen?',
      query_empty_response_advice: 'ℹ️ Als dit onverwacht blijft gebeuren, kan je best eens kijken of er toevallig een zoom ingesteld staat op de pagina, want dit kan het opvraagsysteem breken. Je kan {hotkey} gebruiken om de zoom te resetten.',
      query_table_property: 'Eigenschap',
      query_table_value: 'Waarde',
      retrieving_error: 'Fout aan het ophalen...',
      query_layer: 'Doorzoek een bepaalde locatie op deze kaart voor meer informatie door ergens op de kaart te klikken',
      edit_layer: 'Pas de kaart aan',
      remove_layer: 'Verwijder kaart',
      layer_out_of_range: 'Deze kaart wordt mogelijk niet weergegeven op dit zoomniveau',
      satellite_imagery: 'Geef satellietbeelden weer',
      select_map: 'Selecteer een kaart om toe te voegen',
      maps_to_add_title: 'Toe te voegen kaarten',
      add_maps_filter_mode_aria: 'Filter toe te voegen kaarten op kaartbeeld',
      add_maps_none_in_view: 'Geen kaarten voor dit beeld. Kies Alle of verschuif de kaart.',
      add_map_no_matches: 'Geen kaarten komen overeen met je zoekopdracht',
      add_map_all_added: 'Alle kaarten zijn al toegevoegd',
      opacity_label: 'Doorzichtigheid',
      opacity_label_tooltip: 'Wijzig de doorzichtigheid van de kaart',
      transparent_label: 'Transparent',
      transparent_label_tooltip: 'Maak de achtergrond van de kaart transparent',
      map_improvement_label: 'Pixelmanipulaties toepassen',
      map_improvement_label_tooltip: 'Pas pixelbewerkingen toe op kaarttegels (hertekenen vereist; kan prestaties beïnvloeden).',
      pixel_manipulations_title: 'Pixelmanipulaties',
      pixel_manipulations_default: 'Standaard',
      pixel_manipulations_override: 'Overschrijven',
      pixel_manipulations_use_default: 'Catalogusstandaard gebruiken',
      pixel_manipulations_select_none: 'Niets selecteren',
      pixel_manipulations_use_default_tooltip: 'Catalogusstandaard gebruiken (overschrijving wissen)',
      pixel_manipulations_select_none_tooltip: 'Niets selecteren (overschrijven naar een lege lijst)',
      pixel_manipulations_tooltip: 'Geavanceerd: per-kaart overschrijvingen voor pixelbewerking van tegels. Werkt onafhankelijk van CSS-filters en transparantie. Toegepast na hertekenen; kan prestaties beïnvloeden.',
      map_layers_title: 'Kaartlagen',
      find_available_layers: 'Beschikbare lagen zoeken',
      find_available_layers_loading: 'Server bevragen…',
      layer_catalog_loading: 'Lagenlijst van server laden…',
      find_available_layers_loaded: 'Beschikbare lagen geladen',
      find_available_layers_retry: 'Ophalen mislukt (klik om opnieuw te proberen)',
      server_capabilities_tooltip: 'Servermogelijkheden bekijken (gecachet indien beschikbaar)',
      server_capabilities_title: 'Servermogelijkheden',
      server_capabilities_url_label: 'Server-URL:',
      server_capabilities_error: 'Server niet bereikbaar. Zie console voor details.',
      saved_layers_orphan_hint: '{n} opgeslagen laagnaam(men) niet op de server gevonden en verwijderd.',
      saved_layers_orphan_hint_local: '{n} opgeslagen laagnaam(men) komen niet meer overeen met deze kaart en zijn verwijderd.',
      terms_section_title: 'Gebruiksvoorwaarden',
      tou_section_status_accepted: 'Geaccepteerd',
      tou_section_status_required: 'Actie vereist',
      tou_section_status_dismissed: 'Niet geverifieerd (deze sessie)',
      favorite_add: 'Toevoegen aan favorieten',
      favorite_remove: 'Verwijderen uit favorieten',
      layer_group_title: 'Open Maps',
      meta_type: 'Type',
      meta_region: 'Regio',
      meta_bbox: 'BBox',
      zoom_meta_band: 'Zoombereik',
      zoom_meta_floor: 'Ondergrens',
      zoom_meta_view: 'Beeld',
      zoom_meta_tooltip: 'Het zoombereik is waar deze kaart bedoeld is om op vol detail te tonen. “Ondergrens” is het minimale zoomniveau voor tegelverzoeken als je verder bent uitgezoomd. Boven het maximum van het bereik worden tegels opgerekt (overzoom). Buiten het bereik of onder de ondergrens kan de weergave onvolledig zijn.',
      draw_bbox_on_map: 'Begrenzingskader op de kaart tekenen',
      visual_adjustments: 'Visuele aanpassingen',
      slider_brightness: 'Helderheid',
      slider_contrast: 'Contrast',
      slider_saturation: 'Verzadiging',
      slider_hue_rotate: 'Tint draaien',
      slider_gamma: 'Gamma',
      blend_mode_label: 'Mengmodus',
      invert_colors: 'Kleuren omkeren (donkere modus)',
      reset_visual_default: 'Standaard herstellen',
      map_options_toggle: 'Kaartdetails en lagen',
      inspector_title: 'Kaartinspector',
      inspector_features_grouped: 'Objecten per kaart',
      inspector_map_group_toggle: 'Objectrijen voor deze kaart in de lijst uit- of inklappen (verbergt de overlay niet — gebruik Actieve kaarten)',
      inspector_sources: 'Bronnen',
      inspector_sources_tree: 'Lagen om te inspecteren',
      inspector_esri_viewport: 'ESRI (viewport-query)',
      inspector_wms_arcgis_viewport: 'WMS (ArcGIS REST)',
      inspector_wms_wfs_viewport: 'WMS (GeoServer WFS)',
      wms_arcgis_rest_viewport_probe: 'REST-viewportobjecten (Map Inspector)',
      wms_arcgis_rest_viewport_probe_tooltip: 'Uit: Map Inspector voert geen ArcGIS REST /query-verzoeken meer uit voor deze WMS. WMS-tegels volgen nog steeds Actieve kaarten en laagschakelaars. Handig om verkeer te sparen met de beelden aan.',
      inspector_sources_all: 'Alles',
      inspector_sources_none: 'Geen',
      inspector_sources_visible: 'Alleen zichtbaar',
      inspector_search_placeholder: 'Lijst filteren…',
      inspector_refresh: 'Vernieuwen',
      inspector_list_empty: 'Geen objecten in beeld voor de actieve kaarten.',
      inspector_list_truncated: 'Lijst afgekapt — zoom in voor een kleiner gebied.',
      inspector_kind_vector: 'vector',
      inspector_kind_esri: 'esri',
      inspector_kind_wms: 'wms',
      inspector_kind_wfs: 'wfs',
      inspector_kind_query: 'query',
      inspector_open_table: 'Datatabel',
      inspector_open_data_table: 'Datatabel openen',
      inspector_map_row_menu: 'Kaartacties',
      inspector_table_title: 'Inspectorgegevens',
      inspector_table_search: 'Rijen filteren…',
      inspector_table_close: 'Sluiten',
      inspector_query_ingest: 'Queryresultaten aan inspector toevoegen',
      inspector_query_ingest_auto: 'Queryresultaten automatisch toevoegen',
      inspector_auto_wms_gfi: 'Generieke WMS automatisch (midden viewport)',
      inspector_auto_wms_gfi_tooltip: 'Voert GetFeatureInfo uit op het kaartcentrum bij pannen/zoomen voor WMS-lagen die hier niet via ArcGIS REST of GeoServer WFS lopen.',
      inspector_list_empty_hint_auto: 'Gebruik de querytool voor een exacte klik, of zoom in.',
      inspector_list_empty_hint_manual: '(Rasterkaarten: gebruik query “Toevoegen aan inspector” of automatisch toevoegen.)',
      inspector_scan_progress: 'Scannen… {done}/{total}',
      inspector_query_add_btn: 'Toevoegen aan inspector',
      inspector_query_add_btn_tooltip: 'Huidige queryresultaten aan de Map Inspector-lijst toevoegen',
      inspector_bbox_layer: 'Begrenzing',
      inspector_clear_query_items: 'Geïmporteerde queryrijen wissen',
      inspector_not_available: 'Kaartinspector is in deze sessie niet beschikbaar.',
      inspector_layer_bounds: 'Begrenzing',
      zoom_to_map_area: 'Inzoomen op kaartgebied',
      visibility_locked_tou: 'Accepteer eerst de gebruiksvoorwaarden',
      tou_config_error: 'Configuratiefout',
      tou_link_accepted: 'Gebruiksvoorwaarden (geaccepteerd)',
      tou_link_dismissed: 'Gebruiksvoorwaarden (genegeerd — niet geverifieerd)',
      tou_link_required: 'Gebruiksvoorwaarden (vereist)',
      tou_invalid_title: 'Ongeldige kaartconfiguratie',
      tou_invalid_body: 'Deze kaart vereist een gebruiksvoorwaardenvermelding (touId) in het script, maar die ontbreekt of is ongeldig. De kaart blijft geblokkeerd. Neem contact op met de onderhouder.',
      tou_desc_accepted: 'Je hebt de voorwaarden geaccepteerd. Je kunt ze hieronder opnieuw bekijken:',
      tou_desc_dismissed: 'De pagina met gebruiksvoorwaarden kon niet worden geverifieerd. Je hebt de waarschuwing voor deze sessie genegeerd; de laag is ontgrendeld maar dit telt niet als acceptatie.',
      tou_desc_required: 'Schakel deze laag pas in na het lezen en accepteren van de voorwaarden:',
      tou_read_terms_in: 'Lees de voorwaarden in:',
      tou_accept: 'Ik accepteer',
      tou_unreachable_title: 'Pagina met gebruiksvoorwaarden kon niet worden geladen',
      tou_unreachable_detail_suffix: ' De knop Ik accepteer blijft uit tot de pagina geverifieerd is; er wordt niets opgeslagen.',
      tou_unreachable_hint: 'Negeren verbergt deze melding en ontgrendelt de laag voor deze sessie; er wordt geen acceptatie vastgelegd. Herladen wist dit; neem contact op met de auteur als het aanhoudt.',
      tou_dismiss_session: 'Negeren voor deze sessie',
      tou_reachable_line: 'Pagina met gebruiksvoorwaarden bereikbaar — gecontroleerd {when}.',
      tou_stats_accepted: 'Geaccepteerd',
      tou_stats_baseline_length: 'Basislengte',
      tou_stats_last_checked: 'Laatst gecontroleerd',
      tou_stats_next_check: 'Volgende controle',
      tou_stats_pending: 'In afwachting…',
      tou_stats_on_next_reload: 'Bij volgende herladen',
      tou_stats_chars: '{n} tekens',
      tou_force_check: 'Nu geforceerd controleren',
      tou_checking_url: 'Live-URL controleren…',
      tou_baseline_saved: 'Basis opgeslagen!',
      tou_unchanged: 'Ongewijzigd ({variance})',
      tou_revoked: 'WME Open Maps:\n\nGebruiksvoorwaarden zijn met {percent}% gewijzigd!\n\nToestemming is ingetrokken. Lees en accepteer opnieuw.',
      notice_dismiss: 'Sluiten',
      tou_gate_banner: '"{title}" is toegevoegd. Vouw de rij uit en accepteer de gebruiksvoorwaarden voordat je de kaart inschakelt.',
      add_map_pick_hint: 'Open de lijst of typ om te filteren.',
      user_maps_section_title: 'Jouw kaarten',
      user_maps_add_placeholder: 'Plak My Maps-link (Bewerken, Voorbeeld of Delen)…',
      user_maps_add_button: 'Toevoegen',
      user_maps_default_title: 'Google My Map',
      user_maps_add_invalid: 'Geen kaart-id gevonden. Plak de volledige adresbalk-URL van Google My Maps tijdens bewerken of bekijken (met mid=…). Je hebt geen aparte “KML-link” nodig.',
      user_maps_add_duplicate: 'Deze My Map staat al in je lijst.',
      user_maps_add_error_network: 'Kaartgegevens downloaden mislukt. Controleer de link en probeer opnieuw.',
      user_maps_add_error_parse: 'KML verwerken mislukt. De kaart gebruikt misschien elementen die deze editor nog niet leest.',
      user_maps_kml_unsupported: 'Deze WME-build heeft geen KML-parser (OpenLayers.Format.KML).',
      user_maps_hint: 'Gebruik dezelfde URL als in de adresbalk op google.com/maps/d/… (bijv. …/edit?mid=… of …/viewer?mid=…). OpenMaps haalt de geometrie automatisch bij Google. Accepteer de voorwaarden in de kaartdetails voordat je inschakelt.',
      active_maps_filter_placeholder: 'Filter actieve kaarten…',
      active_maps_filter_all: 'Alle',
      active_maps_filter_favorites: 'Favorieten',
      active_maps_filter_in_view: 'In beeld',
      active_maps_filter_visible: 'Zichtbaar',
      active_maps_filter_tou_pending: 'Gebruiksvoorwaarden open',
      active_maps_filter_no_match: 'Geen kaarten voldoen aan deze filters.',
      active_maps_filter_mode_aria: 'Lijst actieve kaarten filteren',
      reset_terms_button: 'Alle kaartvoorwaarden intrekken (herladen)',
      reset_terms_confirm: 'Alle opgeslagen gebruiksvoorwaarden intrekken? Getroffen kaarten blijven geblokkeerd tot je opnieuw accepteert. De pagina wordt herladen.',
      query_window_close: 'Queryresultaten sluiten',
      query_window_minimize: 'Paneelhoogte minimaliseren of herstellen',
      query_results_for: 'Queryresultaten: {title}',
      tou_gate_add_alert: 'Open Maps — gebruiksvoorwaarden\n\n"{title}" vereist dat je de voorwaarden in de Open Maps-zijbalk bekijkt en accepteert voordat de kaart kan worden ingeschakeld. Vouw deze kaart uit (pijl), open Gebruiksvoorwaarden, volg de links, en tik op Ik accepteer.\n\nDit is normaal; het script werkt.',
      tou_pending_hint: 'Acceptatie van gebruiksvoorwaarden vereist',
      no_layers_enabled_hint: 'Geen kaartlagen ingeschakeld. Open de kaartopties en zet minstens één laag aan.',
      layer_origin_curated: 'In script samengesteld (curated)',
      layer_origin_cloud: 'Van servercatalogus (cloud)',
      layer_origin_unknown: 'Niet in script of servercatalogus',
      layer_origin_default: 'Standaardlaag',
      copy_map_definition_tooltip: 'Kaartdefinitie kopiëren',
      copy_map_definition_menu_all_keep_defaults: 'Kopiëren (alle lagen, standaarden behouden)',
      copy_map_definition_menu_all_make_enabled_default: 'Kopiëren (alle lagen, ingeschakelde lagen als standaard)',
      copy_map_definition_menu_enabled_only_make_default: 'Kopiëren (alleen ingeschakelde lagen, als standaard)',
      copy_done: 'Gekopieerd',
      tou_link_probe_checking: 'Controleren of de pagina met gebruiksvoorwaarden bereikbaar is…',
      tou_link_probe_ok: 'Pagina met gebruiksvoorwaarden is bereikbaar — gecontroleerd {when}.',
      tou_link_probe_fail: 'Pagina met gebruiksvoorwaarden kon niet worden geladen ({detail}).',
      tou_accept_disabled_tooltip: 'Open eerst elke taallink hierboven.',
      errors: {
        network: 'Networkfout',
        network_description: 'Bij het opvragen van informatie werd de volgende statuscode ontvangen: ',
        see_console: 'Bekijk de browserconsole voor meer informatie',
        timeout: 'Time-out',
        timeout_description: 'Antwoord verkrijgen duurde langer dan 10 seconden, waarschijnlijk netwerkprobleem',
        parse_fail: 'Kan foutmelding niet verwerken'
      },
      areas: {
        AL: 'Albania',
        BE: 'België',
        BR: 'Brazilië',
        LU: 'Luxemburg',
        NL: 'Nederland',
        OM: 'Oman',
        US: 'Verenigde Staten',
        HR: 'Kroatië',
        CZ: 'Tsjechië',
        UN: 'Universal',
        EU: 'European Union',
        user: 'Jouw kaarten'
      },
      update: {
        message: 'Nieuwe versie van WME Open Maps geïnstalleerd! Veranderingen:',
        v2_3_0: 'Complete herwerking van het userscript\n- Geef meerdere kaarten tegelijk weer\n- Maak het mogelijk om kaarten te doorzoeken',
        v2_3_1: '- Het inladen en opslagen van de kaarten is opgelost\n- Enkele bugs geplet rond het ordenen van kaarten\n- Een grijze achtergrond toegevoegd aan de laadindicator voor kaarten\n- De doorzoakbaarheid van de BAG-kaart is aangepast',
        v2_3_2: '- Probleem opgelost waarbij het verwijderen van een kaart alle onderliggende kaarten ook verwijderde\n- Het bevragen van een kaart gebeurt nu enkel op zichtbare bevraagbare lagen\n- Kleine veranderingen aan de grenzen en bevragingsinstellingen van sommige kaarten',
        v2_3_3: '- Het verplaatsen van lagen van een kaart is hersteld',
        v2_3_4: '- Kleine veranderingen aan de UI en interne herwerking van code',
        v2_3_5: '- Licht verbeterde verwerking van kaartopzoekingen\n- Probleem opgelost met TamperMonkey-meldingen over het gebruik van externe bronnen',
        v2_3_6: '- Werking op WME beta verbeterd\n- Groupeer kaarten per land\n- Toevoeging van Hectopuntenkaart in Nederland',
        v2_3_7: '- Sorteren van kaartlagen hersteld\n- Opschonen van onbestaande kaartlagen\n- Wegenregister toegevoegd voor België',
        v2_3_8: '- Aanduiding toegevoegd voor niet ondersteunde zoomniveaus\n- Nieuwe laag toegevoegd aan de PDOK-kaart in Nederland',
        v2_3_9: '- Ondersteun de nieuwe URL voor de WME beta',
        v2_3_10: '- Kaartlagen van GBO Provincies vernieuwd',
        v2_3_11: '- Bugfix voor de WME beta waarbij de uitvoering van het script stopte\n(de toevoeging van de lagen in het nieuwe menu volgt later)',
        v2_4_0: '- Ondersteuning voor nieuwe laagselector\n- Orthomozaïek Vl. Tijdsreeksen aangepast om standaard de kaart van 2016 te tonen\n- Kaart met administratieve grenzen van Vlaanderen toegevoegd',
        v2_5_0: '- Het venster met zoekresultaten werd vernieuwd\n- De locaties en voorkeuren voor meerdere kaarten werden bijgewerkt',
        v2_5_1: '- Laat het minimaliseren van zoekresultaten toe\n- Je kan nu ook de originele data zien in plaats van de verwerkte data',
        v2_5_2: '- Je kan nu een nieuwe zoekopdracht starten vanuit het resultatenscherm\n- De volgorde van de zoekresultaten werd verbeterd\n- Zoekresultaten worden nu beter weergegeven tijdens het aanpassen van huisnummers',
        v2_6_0: '- Basiskaart toegevoegd voor Rio de Janeiro\n- Vertalingen verbeterd tijdens het toevoegen van het Portugees',
        v2_6_1: '- PICC kaart voor Wallonië bijgewerkt omdat de kaartlaag met straatnamen hernoemd werd',
        v2_6_2: '- Nieuwe mapdienst voor satellietbeelden in Vlaanderen en Brussel toegevoegd',
        v2_7_0: '- Verschillende verbeteringen aan de interface\n- Toegang tot de externe website van een kaart\n- Mogelijkheid tot verbergen van hulpberichten',
        v2_7_1: '- Bugfix: verbergen van tooltips werkte soms niet goed\n- Bugfix: foutieve aanduiding van probleem weergave op bepaalde zoomniveaus',
        v2_7_2: '- Verbeterde weergave voor te lange tekst in laagselectiemenu\n- Probleem met scriptactivering opgelost wanneer er geen schuine streep in de URL staat\n- Symbool voor map query aangepast naar wijsvinger',
        v2_7_3: '- Interne bugfix voor beta (hasUser functie werd verwijderd)',
        v2_7_4: '- Herstel van een verandering van afstandseenheid\n- Orthofotomozaïek Tijdsreeksen bijgewerkt (België)',
        v2_7_5: '- Nieuwe CRAB Adrespunten kaart\n- Het gedeeltelijk verbergen van tooltips in de nieuwe layout werd opgelost\n- Poging om probleem van onzichtbare kaart bij 100% zichtbaarheid op te lossen\n- Genereer laagmenu opnieuw bij gebruik van evenementmodus',
        v2_7_6: '- Gebied van BAG kaart bijstellen\n- De doorzichtigheid van kaarten zat vast op 100%',
        v2_7_7: '- Een intern probleem opgelost dat over 2 maanden zichtbaar zou worden',
        v2_8_0: '- Locatie van zoekvenster aangepast\n- GBO Provincies kaart werd vervangen door PDOK\n- Code met unsafeWindow verwijderd',
        v2_8_1: '- Hectopunten kaart hersteld (NL)\n- Kadastrale Kaart toegevoegd (NL)\n- BGT kaart verwijderd (NL)',
        v2_8_2: '- Kaart Ortho Vl. 2013-2015 Grootschalig toegevoegd (BE)\n- Kaart Snelheidsregimes en referentiepunten AWV toegevoegd (BE)',
        v2_8_3: '- 1 Aprilgrap van Waze verwijderd\n- N23 Westfrisiaweg kaart toegevoegd (NL)',
        v2_8_4: '- Kaart Administrative Grenzen toegevoegd (BE)',
        v2_8_5: '- CIRB kaart geüpdatet (BE)',
        v2_8_6: '- GIPOD Actueel toegevoegd (BE)',
        v2_8_7: '- Orthomozaïek Vlaanderen bijgewerkt (BE)',
        v2_8_8: '- Orthophotos 2016 en Réseau routier régional toegevoegd (BE)',
        v3_0_0: '- Ondersteuning voor nieuwe maptypes\n- Ondersteunen nieuwe layer menu layout',
        v3_0_1: '- Aanpassingen aan BAG-kaart ongedaan gemaakt (NL)',
        v3_0_2: '- Reverted release 3.0 as there were too many breaking bugs',
        v3_0_3: '- Ondersteunen nieuwe layer menu layout\n- Verwijderen van defecte kaartlagen mogelijk gemaakt',
        v3_0_4: '- Correctie aanpassingen laatste WME update\n- Laadbalken voor inladen kaarttegels hersteld',
        v3_0_5: '- West Virginia Leaves Off kaart toegevoegd (US)\n- Maximumsnelhedenkaart toegevoegd (NL)',
        v3_0_6: '- Verkeersborden en Afgeleide Snelheidslimieten kaarten toegevoegd (BE)\n- Snelheidsregimes en referentiepunten AWV hersteld (BE)',
        v3_0_7: '- Meerdere UI verbeteringen\n- West Virginia Leaves Off kaart bijgewerkt (US)',
        v3_1_0: '- Kaart voor Oman toegevoegd\n- Meedere verbeteringen in kaartweergave\n- Verbeterde layout\n- Andere kaarten aangepast/hersteld',
        v3_1_1: '- Verberg lege kaarttegels\n- Meerdere kleine lay-out en bug fixes',
        v3_1_2: '- Kleine verbeteringen in performantie toegepast',
        v3_1_3: '- Enkele kaarten toegevoegd voor Brussel (BE)',
        v3_1_4: '- Verkeersbordenkaart toegevoegd voor Vlaanderen (BE)',
        v3_1_5: '- Toevoeging van enkele standaardlagen in Wegenregister-kaart (BE)\n- Verbeteringen voor meest recente versie van WME',
        v3_1_6: '- Upgrade naar BAG versie 1.1 en Kadastrale kaart versie 4 (NL)',
        v3_1_7: '- USDA NAIP kaart toegevoegd',
        v3_1_8: '- Gecorrigeerde WV Leaves Off-lagen en transparantie toegevoegd aan WV Leaves Off\n- Meer recente Orthophoto-kaarten toegevoegd voor Wallonië (BE)',
        v3_1_9: '- WV Leaves Off laag updates\n- Enkele Brusselse kaarten hernoemd',
        v3_1_10: '- WV Leaves Off laag updates\n- Enkele Brusselse kaarten hersteld',
        v3_1_11: '- Kaart met kadastrale grenzen toegevoegd (BE)',
        v3_1_12: '- Luchtfoto\'s van Virginia toegevoegd\n- PICC en Brussels Future speed limits kaarten bijgewerkt (BE)\n- Oman National Basemap bijgewerkt',
        v3_1_13: '- Luchtfoto\'s van Tennessee toegevoegd',
        v3_1_14: '- WV Leaves Off laag updates',
        v3_1_15: '- Verbetering voor toekomstige versie van WME',
        v3_1_16: '- Verplaats de kaart van Virginia naar de nieuwe server (US)',
        v3_1_17: '- Luchtfoto\'s van Pennsylvania toegevoegd (US)\n- Correctie aan de begrenzing van de kaart van Tennessee',
        v3_1_18: '- NAIP+-beelden toegevoegd voor Amerikaans grondgebied, Alaska en Hawaii\n- Overtrekken van grijze pixels toegevoegd bij kaarten van Oman',
        v3_1_19: '- Luchtfoto (NL) hersteld door PDOK rechtstreeks op te roepen',
        v3_1_20: '- Aanpassingen voor WME v2.83',
        v3_1_21: '- BAG aangepast (NL)\n- Luchtfoto aangepast (NL)',
        v3_1_22: '- WV Leaves Off laag updates',
        v3_1_23: '- Aanpassingen voor nieuwe lay-out WME',
        v3_1_24: '- North Carolina NC One Map toegevoegd (US)',
        v3_1_25: '- Migratie Vlaamse kaartdiensten naar nieuwe website (BE)\n- PDOK Luchtbeelden bijgewerkt (NL)',
        v3_1_26: '- Aanpassingen voor nieuwe lay-out WME',
        v3_2_1: '- Layout aanpassen voor nieuwe WME',
        v3_2_2: '- WV Leaves Off laag updates',
        v3_2_3: '- Verwijs naar nieuwe Maximumsnelhedenkaart (NL)',
        v3_2_4: '- Vervang NAIP door NAIP+ kaart (US)',
        v3_2_5: '- Maak gebruik van de nieuwe Waze API om tabs aan te maken',
        v3_2_6: '- WV Leaves Off laag updates',
        v3_2_7: '- PICC kaartlagen aangepast (BE)',
        v3_2_8: '- WV Leaves Off laag updates',
        v3_2_9: '- Cadastral borders map vervangen (BE)',
        v3_2_10: '- Probleem met witruimte opgelost in query scherm\n- VLAIO kaart toegevoegd (BE)',
        v3_2_11: '- Publieke oplaadpunten kaart toegevoegd (BE)',
        v3_2_12: '- Hou rekening met het extra beeldmateriaal',
        v3_2_13: '- Adrespunten kaart vervangen met het Adressenregister (BE)\n- Opvragen van data uit Maximumsnelhedenkaart opgelost (NL)',
        v3_2_14: '- Nationaal Wegen Bestand kaart hersteld en dubbele Hectopuntenkaart verwijderd (NL)',
        v3_2_15: '- Migreer GIPOD naar nieuwe locatie met extra kaartlagen (BE)',
        v3_2_16: '- Blokkeer het dupliceren van een kaartlaag (in de toekomst te ondersteunen)\n- Migreer en update Weggegevens en Kadastrale Kaart kaartlagen (NL)',
        v3_2_17: '- Kaarten toegevoegd voor Kroatië (HR)',
        v3_2_18: '- Herstel Brussels Ortho kaart (BE)',
        v3_2_19: '- Voorbereiding voor wijzigingen in WME beta',
        v3_2_20: '- Fix map retrieval breakage due to unexpected changes',
        v3_2_21: '- Fix WV Leaves off and USGS NAIP+ layers (US)',
        v3_2_22: '- IndianaMap toegevoegd (US)',
        v3_2_23: '- Herstel Virginia Aerial Imagery map (US)\n- Advies toegevoegd voor wanneer het queryen nooit een resultaat geeft.',
        v3_2_24: '- WV Leaves Off laag updates (US)',
        v3_2_25: '- IndianaMap updates (US)',
        v3_2_26: '- IndianaMap updates (US)\n- WV Leaves Off laag updates (US)',
        v3_2_27: '- Update van de jaarlijkse orthografische kaarten (BE en NL)',
        v3_2_28: '- CIRB kaart hersteld (BE)',
        v3_2_29: '- Maryland iMAP toegevoegd (US)',
        v3_2_30: '- Kaarten Luxemburg toegevoegd (LU)',
        v3_2_31: '- Brusselse kaarten hersteld (BE)',
        v3_2_32: '- WV Leaves Off laag updates (US)',
        v3_2_33: '- Luchtfoto 2025 kaartlagen hersteld (NL)',
        v3_2_34: '- Rangschikken van kaartlagen hersteld',
        v3_2_35: '- WV Leaves Off layers updated (US)',
        v3_2_36: '- Orthophotos 2024 kaart toegevoegd (BE)\n- Toon standaard alleen verblijfsobjecten in BAG (NL)',
        v3_2_37: '- ČÚZK WMS-kaarten toegevoegd (CZ)',
        v3_2_38: '- ČÚZK WMS gemigreerd naar ags.cuzk.gov.cz (ortofoto, GeoNames, ZABAGED polohopis); overzichtskaart Přehledová mapa toegevoegd (CZ)',
        v2026_03_29_05: '- Crash opgelost wanneer de serverlagenlijst klaar was terwijl alle WMS-sublagen uit stonden',
        v2026_03_31_01: '- Kaartdetails: rustige zoomregel (bereik, optionele WMS-ondergrens, huidig beeld) met korte helptooltip; geen extra kaartlisteners',
        v2026_03_31_02: '- Kaartinspector: viewportlijst van vectorobjecten in geheugen (begrensd), details, markering/zoom, datatabel, optioneel queryresultaten importeren',
        v2026_03_31_03: '- Kaartinspector: ESRI MapServer viewport-query (automatische lijst), laagboom, compacte pictogrammen, markering bij hover',
        v2026_03_31_04: '- Kaartinspector: minimale randen (native pictogramknoppen), WMS-viewport via ArcGIS REST / GeoServer WFS',
        v2026_04_01_01: '- Minder tegelbelasting: geen globale OpenLayers-herlaadpogingen voor tegels; overlaylagen buffer 0 en geen resize-transitie (helpt bij net::ERR_INSUFFICIENT_RESOURCES met veel kaarten)',
        v2026_04_01_02: '- Kaartinspector: automatische WMS GetFeatureInfo op het midden van het zicht voor generieke bevraagbare lagen (optioneel); gedeelde HTML-tabelparser met query-import',
        v2026_04_01_03: '- Kaartinspector: voortgang bij scannen (spinner, gedaan/totaal) tijdens viewport-verzoeken; vernieuw-pictogram draait tot klaar',
        v2026_04_01_04: '- Kaartinspector: Details-paneel en overbodige zoom-/markeerknoppen verwijderd (selectie, markering op kaart en callout blijven)',
        v2026_04_01_05: '- Kaartinspector: compactere objectlijst (kleinere tekst, padding, tussenruimte; hoger scrollgebied) zodat ongeveer twee keer zoveel rijen verticaal passen',
        v2026_04_01_06: '- Kaartinspector: snellere kaart-markering bij hover tussen rijen (geen dubbele OpenLayers-updates; samenvoegen tot één tekening per animation frame)',
        v2026_04_01_07: '- Kaartinspector: beperkt gelijktijdige viewport-laagverzoeken (wachtrij) en voortgang op basis van voltooide calls (blijft niet op 0/N hangen); kortere timeout per verzoek',
        v2026_04_01_08: '- Kaartinspector: ESRI MapServer-, ArcGIS REST WMS- en GeoServer WFS-viewportverzoeken lopen nu allemaal via dezelfde begrensde wachtrij zodat de voortgang betrouwbaar oploopt',
        v2026_04_01_09: '- Optionele omzeiling als WME de rechterzijbalk onder zoom 12 beperkt: standaard aan (pointer-events + inert); uit via de voettekst van Open Maps als je voorraad-WME wilt',
        v2026_04_01_10: '- Catalogus: ArcGIS Online World Heritage Sites FeatureServer (punten) met Map Viewer-link (anders dan de laag UNESCO Sites Navigator)',
        v2026_04_01_11: '- Catalogus: ArcGIS Online World_Heritage_UNESCO FeatureServer (punten) met Map Viewer-link (los van World_Heritage_Sites en UNESCO/ Sites Navigator)',
        v2026_04_01_13: '- ESRI_FEATURE (ArcGIS FeatureServer-vectoren): geometrieparsing hersteld (gedeelde openMapsEsriGeometryToOpenLayers) en verouderde query-antwoorden bij pannen genegeerd',
        v2026_04_01_14: '- Kaartinspector: groepsvak schakelt overlay zoals het oog bij Actieve kaarten; aantal per kaart; ⋮-menu (Open datatabel eerst); geen volledige viewport-herscan bijzelfde view-bucket (Vernieuwen dwingt); callout blijft open bij kaart pannen; callout 110% van inspecteurvenster; low-zoom zijbalk-unlock verwijderd',
        v2026_04_02_01: '- Kaartopties: voeg een Map Inspector-backend tag toe voor WMS-URLs (ArcGIS REST vs GeoServer WFS) zodat editors begrijpen welke viewport-aanvragen zullen worden uitgevoerd.',
        v2026_04_02_02: '- Kaartopties: maak de WMS inspector-backend indicator compact (extra “ArcGIS REST” / “GeoServer” tag direct na Type; geen extra label).',
        v2026_04_02_03: '- ESRI_FEATURE (ArcGIS FeatureServer): puntmarkeringen volgen de kleur en schaal van de zijbalk-avatar (130% van 32px), witte rand en zachte schaduw; hover/inspector-markering met grotere halfdoorzichtige witte halo.',
        v2026_04_02_04: '- ESRI_FEATURE: punten als native OpenLayers-cirkels (WME tekent data-URL externalGraphics vaak niet); FeatureServer-vectorlagen boven WME POI-overlays geplaatst zodat markeringen zichtbaar zijn; Map Inspector-markering blijft bovenop.',
        v2026_04_02_05: '- ESRI_FEATURE: symboolgrootte 130% van de Map Inspector-avatar (16px); canvas-pictogrammen met schaduw; tweedelige markering (halfdoorzichtige halo onder marker, vaste witte ring erboven); kaart-hover markeert objecten.',
        v2026_04_02_06: '- ESRI_FEATURE: punten weer altijd als native OpenLayers-cirkels (WME tekent canvas-data-URL externalGraphics vaak niet, waardoor markers onzichtbaar bleven als het pictogram wél werd gegenereerd).',
        v2026_04_02_07: '- ESRI_FEATURE: dunnere witte rand; sterkere highlight-halo; kaart-hover werkt altijd (ook vóór vernieuwen van de inspectorlijst); gemarkeerd punt op een lift-laag boven andere punten; klik opent Map Inspector indien nodig en selecteert zoals de lijst.',
        v2026_04_02_08: '- ESRI_FEATURE: lift-laag + verborgen bron verwijderd (markers konden onzichtbaar blijven na un-hover); tekenvolgorde-bump voor het gemarkeerde punt; sterkere witte halo.',
        v2026_04_02_09: '- ESRI_FEATURE: highlight-halo ~95% dekkend; halo alleen onder actief symbool, actieve FeatureServer-laag boven andere ESRI-lagen tijdens markering; kaart-hover met pixel-radius fallback voor kleine punten.',
        v2026_04_02_10: '- Kaartinspector: aparte hover- vs selectie-markering op kaart en in de lijst (beide tegelijk; selectie boven hover; elke ESRI-punt krijgt een eigen halo onder dat symbool).',
        v2026_04_02_11: '- Kaartinspector: ESRI-halo\'s blijven onder symbolen (z-volgorde bij twee FeatureServer-lagen); witte hover-ring (geen blauwe rand); halo\'s alleen bij actieve hover/selectie; kaart-callout sluiten wist selectie.',
        v2026_04_02_12: '- Kaartinspector: halo-lagen geforceerd onder FeatureServer-bron na herschikken; klik op kaart sluit feature-callout (verkeerde skip op olMap.div verwijderd).',
        v2026_04_02_13: '- Kaartinspector: in-memory vector-feature refs opnieuw koppelen na pannen / ESRI_FEATURE-refresh zodat selectie-markering op het symbool blijft.',
        v2026_04_02_14: '- Kaartinspector: kaart-callout alleen sluiten bij klik buiten; pannen/slepen sluit niet meer (drempel op pointer-verplaatsing).',
        v2026_04_03_01: '- Kaartinspector: feature-callout blijft open tijdens pannen (OpenLayers move annuleert sluiten); inspecteurvenster deels buiten beeld sleepbaar; alleen de objectlijst scrollt (geen verticale balk op het hele venster); geen horizontale scrollbalk op de lijst.',
        v2026_04_03_02: '- Kaartinspector: objectlijst weer zichtbaar (flex-lijst stort niet meer in op nulhoogte; minimaliseren zet body terug als flex-kolom).',
        v2026_04_03_03: '- Kaartinspector: geselecteerde ESRI_FEATURE-laag altijd boven andere FeatureServer-overlays (fix vroege return wanneer halo-laag nog niet op de OL-kaartlijst staat).',
        v2026_04_03_04: '- Kaartinspector: ESRI_FEATURE z-pin werkt ook als handle-laag-ref ≠ feature-ref (match op laagnaam); select/hover-bron voor elke ESRI-avatar-geometrie (niet alleen Point); vectorlaag omhoog ook zonder bbox-handle.',
        v2026_04_03_05: '- Kaartinspector: geen volledige ESRI_FEATURE-kaartlagen meer herschikken bij hover/select; tijdelijk gekloonde puntsymbolen op lift-lagen boven overlays (ringen/halo\'s ongewijzigd).',
        v2026_04_03_06: '- Kaartinspector: WMS/WFS/remote-query-geometrieën (alleen geometrie) gebruiken dezelfde avatar-gekleurde lift/halo/ring voor punten en ESRI-achtige lijn/vlak-markering als ESRI_FEATURE.',
        v2026_04_03_07: '- Kaartinspector: alleen-geometrie-rijen (WMS/WFS/query) tonen altijd avatar-gekleurde symbolen op de kaart zolang de inspector open is, niet alleen bij lijst-hover of selectie.',
        v2026_04_03_08: '- Kaartinspector: kaart-hover en klik werken op vaste WMS/WFS/query-symbolen (zelfde hit-testpad als ESRI_FEATURE-vectoren).',
        v2026_04_03_09: '- Kaartinspector: kaartklik in document-capturefase vóór WME Places/POI-overlays, zodat inspector-symbolen en ESRI_FEATURE-punten selecteerbaar blijven als Places aan staat.',
        v2026_04_03_10: '- Kaartinspector: inspector-markeringen, viewport-geometrieën en ESRI_FEATURE-lagen samen bovenaan de OpenLayers-stack (na Places); re-pin bij addlayer zodat symbolen boven Places blijven.',
        v2026_04_03_11: '- Kaartinspector: hoge CSS z-index op OpenMaps/inspector/ESRI_FEATURE layer-divs zodat WME Places halfdoorzichtige vectoren niet boven onze symbolen tekenen (alleen OL-index volstaat niet in sommige WME-builds).',
        v2026_04_03_12: '- Kaartinspector / Places: z-index-basis omhoog (~2^31-bereik) zodat **alle** ESRI_FEATURE-symbolen (niet alleen inspector lift/markering) boven Places blijven; overlay-stack opnieuw vastzetten na laden van FeatureServer-features.',
        v2026_04_03_13: '- Kaartinspector: tekst in de object-detail-callout is selecteerbaar en kopieerbaar (map user-select overschreven).',
        v2026_04_03_14: '- Kaartinspector / Places: overlay-laag-`z-index` vanaf **2147483647 naar beneden** (één stap per laag) zodat de **achterste** vastgepinde laag (normale ESRI_FEATURE-symbolen) niet op “basis+1” blijft in een band waar WME Places tussen tekent; zelfde `z-index` op canvas/SVG onder de layer-div met `!important`.',
        v2026_04_03_15: '- Kaartinspector / Places: OpenLayers-lagen oplossen op **`layer.name`** als `olMap.layers.indexOf(handleLayer)` −1 is (WME wrapt of vervangt soms de instantie). Pinnen en CSS-`z-index` richten zich nu op de **actieve** kaartlaag.',
        v2026_04_03_16: '- Kaartinspector / Places: ESRI_FEATURE-vectorlagen gebruiken een **unieke** OpenLayers-`layer.name` per kaartregel (`OpenMaps_ESRI_FEATURE_` + map-id) en `openMapsMapId` voor oplossen. Dubbele kaarttitels zorgen er niet meer voor dat `openMapsResolveLayerOnOlMap` de verkeerde laag raakt, zodat normale FeatureServer-symbolen dezelfde hoge `z-index` krijgen als inspector-overlays (boven WME Places).',
        v2026_04_03_17: '- Kaartinspector / Places: OpenLayers **`layer.setZIndex`** zet `div.style.zIndex` **zonder** `!important` en **wist** daarmee onze vastgepinde overlay-`z-index` na `resetLayersZIndex` / redraw (normale ESRI-symbolen onder Places, inspector leek goed). **`OpenLayers.Layer.prototype.setZIndex`** en **`map.resetLayersZIndex`** zijn nu gehookt om direct daarna de overlay-`!important`-waarden opnieuw te zetten.',
        v2026_04_03_18: '- Kaartinspector / Places: overlay-`z-index` wordt nu afgedwongen met **`!important`-regels in een geïnjecteerde stylesheet** (`.openmaps-ol-overlay-z[data-openmaps-ol-ztok]`), niet alleen inline. OpenLayers kan gewone inline `z-index` blijven zetten; **auteur-`!important` in een stylesheet wint van niet-important inline**, zodat normale ESRI_FEATURE-symbolen boven WME Places blijven. Ook **`OpenLayers.Map.prototype.resetLayersZIndex`** gehookt (niet alleen de live kaartinstantie) en her-toepassen alleen als de kaart **`W.map.getOLMap()`** is, zodat andere OpenLayers-kaarten op de pagina het regelset niet kunnen verstoren.',
        v2026_04_03_19: '- Kaartinspector / Places: **pinnen en CSS-`z-index` richten zich nu alleen op lagen die echt op `olMap.layers` staan**, daarna een **sweep** naar elke `OpenMaps_ESRI_FEATURE_*`-vector op de kaart. Eerder zorgde terugvallen op de handle-laag bij `indexOf` −1 ervoor dat **`setLayerIndex` werd overgeslagen** en stylesheet-tokens op een **verouderde losgekoppelde `div`** terechtkwamen terwijl de normale symbolen op WME’s vervangende laag tekenden — vandaar dat markeringen (zelfde live refs) goed leken maar rustige punten onder Places bleven. **Google Places** is een native laag die WME al boven venue-vlakken zet; dat was een nuttige vergelijking, niet de oorzaak.',
        v2026_04_03_20: '- Kaartinspector / Places: **hover/klik map-id** voor ESRI_FEATURE gebruikt niet langer `h.layer === hit.layer` (faalt als WME de OL-instantie vervangt). Gebruikt `openMapsMapId` / `OpenMaps_ESRI_FEATURE_<id>` / `openMapsResolveLayerOnOlMap` zodat overlappende kaarten de markering niet laten flikkeren. **Gesweep**te overlay-lagen worden gesorteerd op **Actieve kaarten (handles)**-volgorde zodat `setLayerIndex` de FeatureServer-stack niet elke pin herschikt. **Hoist** van OpenMaps-overlay-`div`s naar het einde van `map.viewPortDiv` als direct kind (tie-break bij teken-volgorde). CSS-selectors krijgen voorvoegsel **`#<olMap.div.id>`** indien aanwezig voor hogere specificiteit t.o.v. WME. **`moveend`** debouncet een her-pin na pannen.',
        v2026_04_03_21: '- Kaartinspector / Places: vastgepinde vector-overlay-`div`s / `canvas` / `svg` krijgen **`pointer-events: none !important`**. Ze tekenden boven WME Places maar waren nog steeds de **DOM-hit target**, dus Places kreeg geen klikken (events **bubbelen niet** tussen sibling-lagen). ESRI-selectie blijft via **document-capture** + pixel-hit-test (`trySelectEsriFeatureFromClick`); OpenLayers `mousemove` op de kaart blijft werken. Lost op dat Places onselecteerbaar bleef tot pannen na verlaten van de kaart / z-order-gevechten.',
        v2026_04_03_22: '- **WME SDK-first:** `getWmeSdk` (script-id `570591`), begrensde wacht (~90s) op OpenLayers/W.map met eenmalige foutlog, `Sidebar.registerScriptTab` met terugval op `W.userscripts`, kaart-events via SDK `Events` (`wme-map-move-end` / `wme-map-zoom-changed`) met `moveend`-fallback, satellietbeelden via `Map.isLayerVisible` / `setLayerVisibility` + `trackLayerEvents` indien beschikbaar, tooltips via Bootstrap 5 `Tooltip` (geen jQuery). OpenLayers-prototype z-index-hooks en `unsafeWindow`+`GM_xmlhttpRequest` blijven gedocumenteerde polyfills voor CSP/sandbox en OL-stacking.',
        v2026_04_03_23: '- **Onderhoud:** Regiokaart-commentaar na de scriptheader; `//#region OpenMapsSdkBootstrap` (SDK-hulpfuncties + OpenLayers-wacht + `onWmeReady`-prefix tot SDK-koppeling) en `//#region OpenMapsBoot` (`onWmeInitialized`, `bootstrap`, startaanroep) voor navigatie in de editor—geen gedragswijziging.',
        v2026_04_03_24: '- **UI:** Verbergt de native Google Maps-knop “Search this area” / “Zoek in dit gebied” op de kaart (WME Places / Google-basiskaart). Komt niet van OpenMaps; CSS plus een kleine DOM-sweep voor gangbare talen.',
        v2026_04_03_25: '- **UI:** “Search this area” is WME’s React-pil (`container--*`, `.w-icon-search`, `div.text`), niet `.gm-style`. Verbergen met `:has(...)`-CSS en een `div.text`-sweep; oude Google-controlverberging blijft.',
        v2026_04_03_26: '- **Kaartinspector:** Het selectievakje per kaart in de lijst klapt alleen rijen in of uit; het wijzigt niet meer de zichtbaarheid in Actieve kaarten (oog in de zijbalk blijft de overlay aansturen).',
        v2026_04_03_27: '- **UI:** “Zoek in dit gebied”-chip: verberg-sweep **direct** bij DOM-mutaties (niet pas na 80 ms), plus samengevoegde `requestAnimationFrame`-rondes en een laatste timeout; ook sweep na **`wme-map-move-end`**, **`wme-map-zoom-changed`** en OpenLayers **`moveend`** zodat de pil niet even flitst bij de eerste verschuiving na herladen.',
        v2026_04_03_28: '- **WMS (ArcGIS REST):** In kaartopties staat een vakje om REST-viewport-objectquery’s voor Map Inspector los van WMS-tegelzichtbaarheid aan of uit te zetten (tegels volgen Actieve kaarten + laagschakelaars).',
        v2026_04_03_29: '- **ESRI_FEATURE:** Kaartopties tonen geen WMS-achtige “transparante achtergrond”, CSS-beeldfilters of pixelmanipulaties meer (niet van toepassing op FeatureServer-vectoren en riep `mergeNewParams` op vectorlagen aan). Latere builds schrappen ook de doorzichtigheidsschuif voor vectoren en verbergen het bbox-vak voor Universeel (UN).',
        v2026_04_03_30: '- **Universeel (regio UN):** Geen optie “begrenzingskader tekenen”; bbox-overlay blijft uit. **ESRI_FEATURE:** Geen doorzichtigheidsschuif; vectorlaag altijd op volle opacity (opgeslagen waarde wordt voor dit type genegeerd).',
        v2026_04_03_31: '- **Fix:** Universele (UN) kaarten tonen het bbox-vakje niet meer en geen lege “Visuele aanpassingen”; ESRI_FEATURE-kaarten tonen daar geen doorzichtigheidsschuif meer (engine houdt vectoren al op volle opacity).',
        v2026_04_03_32: '- **Jouw kaarten:** Voeg **Google My Maps** toe met een deel-/embedlink of kaart-id; KML wordt opgehaald (Tampermonkey) en als vector-overlay getekend. Opgeslagen in instellingen; accepteer **Google**-voorwaarden per kaart. Zelfde opslag is bedoeld voor eigen WMS / ArcGIS / XYZ later.',
        v2026_04_03_33: '- **Jouw kaarten:** Duidelijkere tekst (geen aparte “KML-link” nodig); **bewerken / viewer / delen**-URL’s met `mid=` worden via `URL` + hash-fallback geparsed. Afknippen van aanhalingstekens/rare leestekens aan geplakte links.',
        v2026_04_03_34: '- **Fix (satelliet / My Maps):** Google My Maps- en ESRI_FEATURE-vectorlagen worden alleen **gestack-pind** (OpenLayers-index + overlay z-index) als de rij actief is en de laag zichtbaar is. Verborgen of buiten-gebied-kaarten komen niet meer via de laag-sweep terug in de stack. **Pan/zoom**-herpin is **gedebounced** (~220 ms) zodat WME-satelliettiles niet worden verstoord door voortdurend herschikken. Overlay z-index-regels worden gewist als er niets te pinnen is. **Aerial-vloer** voor tile-overlays matcht ook de laagnaam `satellite_imagery` als `earthengine-legacy` ontbreekt.',
        v2026_04_03_35: '- **Fix (satelliet / My Maps):** Google My Maps KML-vectoren zitten **niet meer** in de ESRI-achtige overlay-pin (bovenkant `olMap` + `!important` z-index + viewport-`div`-hoist). Ze worden alleen via **`syncOpenMapsLayerIndices`** boven luchtfoto’s gezet, net als tile-overlays. De agressieve pin-stack verstoorde alsnog het laden van WME-satelliettiles als My Maps de enige actieve laag was.',
        v2026_04_03_36: '- **Fix (satelliet / My Maps):** **`syncOpenMapsLayerIndices`** roept **`setLayerIndex` niet meer** aan op een My Maps-rij zolang die **verborgen**, **buiten gebied** is of de OL-laag **niet zichtbaar** is (de vector bleef op de kaart en werd alsnog herschikt). **Laag-index-math** gebruikt alleen “deelnemende” handles. Het globale **`setZIndex` / `resetLayersZIndex`**-herpad draait alleen als een **ESRI_FEATURE**-overlay-pin of **Map Inspector**-stack het echt nodig heeft, zodat satelliet en andere WME-lagen niet bij elke pan/zoom door overlay-CSS-work gaan als alleen een (verborgen) My Maps in Actieve kaarten staat.',
        v2026_04_03_37: '- **Fix (satelliet / My Maps):** **`syncOpenMapsLayerIndices` installeert niet langer** bij elke sync de globale OpenLayers-hooks **`Layer.setZIndex`** / **`Map.resetLayersZIndex`**. Die hooks werden al gezet zodra er **een** OpenMaps-regel bestond (bijv. verborgen My Map), waardoor **elke** WME-laag (inclusief satelliet) door onze wrapper bleef gaan. Hooks en **`moveend`**-herpin worden alleen gezet als **`openMapsOverlayPinStackHasWork()`** (ESRI_FEATURE-pin of Map Inspector-overlays). **`pinOpenMapsOverlayStackTop`** zet dezelfde hooks de eerste keer dat er echt een niet-lege overlay-stack wordt gepind.',
        v2026_04_03_38: '- **Fix (satelliet / My Maps):** Verborgen/buiten-gebied Google My Maps-lagen worden nu **losgekoppeld van `W.map` / `olMap`** (verwijderd, niet alleen `setVisibility(false)`), zodat alleen al een My Maps-regel in Actieve kaarten OpenLayers-laagvolgorde of satelliet-tegelstroom niet meer kan beïnvloeden. De laag wordt pas opnieuw opgebouwd wanneer de rij weer zichtbaar wordt.',
        v2026_04_03_39: '- **Hotfix:** Zet het v2026.04.03.38 My Maps-loskoppelpad terug om opstartstabiliteit te herstellen. Gedrag van v2026.04.03.37 blijft: geen globale OL-hook-install vanuit `syncOpenMapsLayerIndices`; geen ESRI-achtige pin voor My Maps.',
        v2026_04_03_40: '- **Hotfix rollback:** Nog een stap terug naar het **v2026.04.03.36 runtime-pad** (hook-/`moveend`-registratiestroom van voor v37 herstellen) om script-opstart te herstellen terwijl satelliet/My Maps-debugging doorgaat.',
        v2026_04_03_41: '- **Opstartfix:** Sommige bridge-/Tampermonkey-omgevingen geven wel `wme-initialized`, maar nooit `wme-ready`. OpenMaps houdt nu de normale `wme-ready`-listener **en** start een bewaakte fallback-timer (eenmalige start), zodat opstarten niet kan blijven hangen op “waiting for wme-ready signal…”.',
        v2026_04_03_42: '- **Fix (satelliet / My Maps):** Google My Maps-vectoren vallen **volledig buiten `setLayerIndex` in `syncOpenMapsLayerIndices`** (niet alleen als verborgen). Zichtbare KML-lagen werden nog steeds bij elke sync/KML-refresh boven luchtfoto herschikt, wat WME-satelliettiles na pan/zoom kon laten stoppen. My Maps blijft op de standaard OL-stackpositie; tegel/WMS/ESRI-overlays synchroniseren nog steeds boven luchtfoto.',
        v2026_04_04_01: '- **Fix (satelliet / My Maps):** **`syncOpenMapsLayerIndices` installeert niet langer** bij **elke** run de globale OpenLayers-hooks **`Layer.setZIndex`** / **`Map.resetLayersZIndex`** (de v40-rollback had dat teruggebracht). Satelliet en andere WME-lagen gingen dan alsnog door onze wrapper zodra er **een** OpenMaps-regel was. Hooks worden gezet als **`pinOpenMapsOverlayStackTop`** een niet-lege ESRI/inspector-stack pint; **`addlayer` / gedebounced `moveend`** alleen als **`openMapsOverlayPinStackHasWork()`**. **`minForeignAbove`** loopt nu over **`olMap.layers`** met **opgeloste OL-laagrefs**, zodat My Maps-vectoren niet als “vreemde” WME-lagen tellen als `W.map.getLayers()` andere objectidentiteiten geeft dan `handles[].layer`.',
        v2026_04_04_02: '- **Fix (satelliet / My Maps):** Tegel-stacking gebruikt nu **`olMap.getLayerIndex`** voor zowel de **luchtfoto-vloer** als **`minForeignAbove`** (nooit array-loopindex mengen met `W.map.getLayerIndex`). Als die uit elkaar liepen, konden tegellagen in ongeldige slots terechtkomen en Earth Engine / satelliet verstoren. **Google My Maps**-vectoren worden uit `W.map`/`olMap` gehaald met **`removeLayer`** zodra de rij uit staat (verborgen, geen sublaag, buiten gebied of ToU niet geaccepteerd)—niet alleen `setVisibility(false)`—en weer toegevoegd als de rij aan gaat. **KML-laden** roept **`syncOpenMapsLayerIndices` niet meer** aan na elke fetch.',
        v2026_04_04_04: '- **Fix (satelliet / My Maps):** WME-wegen en satelliet die leeg worden kort na laden van My Maps, wijst sterk op een **WebGL-context crash** (Waze’s native maprenderer bezwijkt). OpenMaps **passeert WME’s `W.map.addLayer`-wrapper nu volledig** voor zware vectorlagen (My Maps / ESRI_FEATURE) en voegt ze direct toe aan de onderliggende OpenLayers-engine. Dit voorkomt dat WME’s React-state duizenden van onze ruwe vectoren probeert te verwerken. KML vraagt nu om **`Canvas`-rendering** in plaats van direct SVG, en beperkt KML tot **1500** features maximaal om WME’s geheugenlimieten te beschermen.',
        v2026_04_04_06: '- **Fix (satelliet bug #3):** Koppeling van `visibilitychanged` en `moveend` events losgemaakt van de standaard tile-laag levenscyclus om te zorgen dat Google My Maps-instanties niet per ongeluk WME-kaartinteracties beïnvloeden terwijl ze zijn losgekoppeld.'
      }
    },
    fr: {
      tab_title: 'Open Maps',
      maps_title: 'Cartes Actives',
      sidebar_unlock_low_zoom: 'Déverrouiller la barre latérale (z<12)',
      sidebar_wme_lock_respect: 'Verrouillage WME sous zoom 12',
      sidebar_unlock_low_zoom_tooltip: 'Permet d’utiliser la barre latérale droite (couches, scripts, etc.) en dessous du niveau de zoom 12. WME limite cela par défaut. Désactivez si le comportement devient étrange après une mise à jour.',
      sidebar_wme_lock_respect_tooltip: 'Rétablit le comportement WME par défaut pour la barre latérale droite sous le zoom 12.',
      terms_section_title: 'Conditions d’utilisation',
      tou_section_status_accepted: 'Accepté',
      tou_section_status_required: 'Action requise',
      tou_section_status_dismissed: 'Non vérifié (cette session)',
      find_available_layers: 'Trouver les couches disponibles',
      find_available_layers_loading: 'Interrogation du serveur…',
      layer_catalog_loading: 'Chargement de la liste des couches depuis le serveur…',
      find_available_layers_loaded: 'Couches disponibles chargées',
      find_available_layers_retry: 'Échec du chargement (cliquer pour réessayer)',
      tou_pending_hint: 'Acceptation des conditions d’utilisation requise',
      no_layers_enabled_hint: 'Aucune couche de carte n’est activée. Ouvrez les options de la carte et activez au moins une couche.',
      layer_origin_curated: 'Défini dans le script',
      layer_origin_cloud: 'Catalogue serveur (cloud)',
      layer_origin_unknown: 'Absent du script et du catalogue',
      layer_origin_default: 'Couche par défaut',
      copy_map_definition_tooltip: 'Copier la définition de la carte',
      copy_map_definition_menu_all_keep_defaults: 'Copier (toutes les couches, conserver les valeurs par défaut)',
      copy_map_definition_menu_all_make_enabled_default: 'Copier (toutes les couches, définir les couches activées par défaut)',
      copy_map_definition_menu_enabled_only_make_default: 'Copier (couches activées uniquement, les définir par défaut)',
      copy_done: 'Copié',
      tou_accept_disabled_tooltip: 'Ouvrez d’abord chaque lien de langue ci-dessus.',
      no_local_maps: 'Aucune carte disponible ici',
      opacity_label: 'Opacité',
      map_improvement_label: 'Appliquer des manipulations de pixels',
      map_improvement_label_tooltip: 'Applique un traitement au niveau des pixels (nécessite un redessin; peut impacter les performances).',
      pixel_manipulations_title: 'Manipulations de pixels',
      pixel_manipulations_default: 'Par défaut',
      pixel_manipulations_override: 'Remplacer',
      pixel_manipulations_use_default: 'Utiliser la valeur du catalogue',
      pixel_manipulations_select_none: 'Ne rien sélectionner',
      pixel_manipulations_use_default_tooltip: 'Utiliser la valeur du catalogue (effacer le remplacement)',
      pixel_manipulations_select_none_tooltip: 'Ne rien sélectionner (remplacer par une liste vide)',
      pixel_manipulations_tooltip: 'Avancé : remplacements par carte pour le traitement des pixels des tuiles. Indépendant des filtres CSS et de la transparence. S’applique après redessin et peut coûter en performances.',
      areas: {
        BE: 'Belgique',
        BR: 'Brésil',
        LU: 'Luxembourg',
        NL: 'Pays-Bas',
        OM: 'Oman',
        US: 'États Unis',
        HR: 'Croatie',
        CZ: 'Tchéquie',
        UN: 'Universal',
        EU: 'European Union'
      },
    },
    'pt-BR': {
      tab_title: 'Open Maps',
      maps_title: 'Ativar Mapas',
      sidebar_unlock_low_zoom: 'Liberar barra lateral abaixo do zoom 12',
      sidebar_wme_lock_respect: 'Usar bloqueio WME em zoom baixo',
      sidebar_unlock_low_zoom_tooltip: 'Permite usar a barra lateral direita (camadas, scripts etc.) com zoom abaixo do nível 12. O WME costuma limitar isso. Desative se algo falhar após uma atualização.',
      sidebar_wme_lock_respect_tooltip: 'Restaura o comportamento padrão do WME para a barra lateral direita com zoom abaixo do 12.',
      no_local_maps: 'Não foram encontrados mapas para esta área',
      expand: 'Clique para expandir',
      collapse: 'Clique para colapsar',
      hideshow_layer: 'Ocultar/Mostrar mapa',
      query_window_title: 'Consulta de Localização do Mapa',
      query_window_loading: 'Resgatando informação do serviço do mapa...',
      query_window_switch: 'Alternar entre dados processados e originais',
      query_window_query: 'Realize essa consulta novamente em outro lugar no mapa',
      query_empty_response: 'Nenhuma resposta recebida do serviço do mapa neste local. Talvez tente em outro local ou tente consultar outra camada?',
      query_empty_response_advice: 'ℹ️ Se esse problema persistir, você pode querer verificar se a página tem um zoom aplicado a ela, pois isso pode quebrar a consulta. Você pode pressionar {hotkey} para redefinir o zoom.',
      query_table_property: 'Propriedade',
      query_table_value: 'Valor',
      retrieving_error: 'Resgatando erro...',
      query_layer: 'Consulte uma determinada localização deste mapa para obter mais informações clicando em algum lugar no mapa',
      edit_layer: 'Editar mapa',
      remove_layer: 'Remover mapa',
      layer_out_of_range: 'Mapa não pode ser exibido no nível de zoom atual',
      satellite_imagery: 'Mostrar imagem satélite',
      select_map: 'Selecione o mapa para adicionar',
      add_map_no_matches: 'Nenhum mapa corresponde à sua busca',
      add_map_all_added: 'Todos os mapas já foram adicionados',
      opacity_label: 'Opacidade',
      opacity_label_tooltip: 'Ajustar a transparência da camada',
      transparent_label: 'Transparência',
      transparent_label_tooltip: 'Fazer o mapa de plano de fundo transparente',
      map_improvement_label: 'Aplicar manipulações de pixels',
      map_improvement_label_tooltip: 'Aplicar processamento de pixels nos tiles (requer redesenho; pode afetar o desempenho).',
      pixel_manipulations_title: 'Manipulações de pixels',
      pixel_manipulations_default: 'Padrão',
      pixel_manipulations_override: 'Substituir',
      pixel_manipulations_use_default: 'Usar padrão do catálogo',
      pixel_manipulations_select_none: 'Selecionar nenhum',
      pixel_manipulations_use_default_tooltip: 'Usar padrão do catálogo (limpar substituição)',
      pixel_manipulations_select_none_tooltip: 'Selecionar nenhum (substituir por lista vazia)',
      pixel_manipulations_tooltip: 'Avançado: substituições por mapa para processamento de pixels dos tiles. Funciona de forma independente de filtros CSS e transparência. Aplica após redesenho e pode custar desempenho.',
      map_layers_title: 'Camadas do mapa',
      find_available_layers: 'Encontrar camadas disponíveis',
      find_available_layers_loading: 'Consultando o servidor…',
      layer_catalog_loading: 'A carregar lista de camadas do servidor…',
      find_available_layers_loaded: 'Camadas disponíveis carregadas',
      find_available_layers_retry: 'Falha ao obter (clique para tentar de novo)',
      terms_section_title: 'Termos de uso',
      tou_section_status_accepted: 'Aceito',
      tou_section_status_required: 'Ação necessária',
      tou_section_status_dismissed: 'Não verificado (esta sessão)',
      favorite_add: 'Adicionar aos favoritos',
      favorite_remove: 'Remover dos favoritos',
      layer_group_title: 'Open Maps',
      meta_type: 'Tipo',
      meta_region: 'Região',
      meta_bbox: 'BBox',
      draw_bbox_on_map: 'Desenhar caixa de limite no mapa',
      visual_adjustments: 'Ajustes visuais',
      slider_brightness: 'Brilho',
      slider_contrast: 'Contraste',
      slider_saturation: 'Saturação',
      slider_hue_rotate: 'Rotação de matiz',
      slider_gamma: 'Gama',
      blend_mode_label: 'Modo de mesclagem',
      invert_colors: 'Inverter cores (modo escuro)',
      reset_visual_default: 'Restaurar padrão',
      map_options_toggle: 'Detalhes e camadas do mapa',
      zoom_to_map_area: 'Aproximar área do mapa',
      visibility_locked_tou: 'Aceite os Termos de uso primeiro',
      tou_config_error: 'Erro de configuração',
      tou_link_accepted: 'Termos de uso (aceitos)',
      tou_link_dismissed: 'Termos de uso (dispensados — não verificados)',
      tou_link_required: 'Termos de uso (obrigatório)',
      tou_invalid_title: 'Configuração de mapa inválida',
      tou_invalid_body: 'Este mapa exige uma entrada de Termos de uso (touId) no script, mas está ausente ou inválida. O mapa permanece bloqueado por segurança. Contacte o mantenedor do script.',
      tou_desc_accepted: 'Você aceitou os termos. Pode revê-los abaixo:',
      tou_desc_dismissed: 'A página dos Termos de uso não pôde ser verificada. Você dispensou o aviso só para esta sessão; a camada fica desbloqueada, mas isso não conta como aceitação.',
      tou_desc_required: 'Antes de ativar esta camada, revise e aceite os termos:',
      tou_read_terms_in: 'Ler termos em:',
      tou_accept: 'Aceito',
      tou_unreachable_title: 'A página dos Termos de uso não pôde ser carregada',
      tou_unreachable_detail_suffix: ' O botão Aceito permanece desativado até a página ser verificada; nada é salvo.',
      tou_unreachable_hint: 'Dispensar oculta este aviso e desbloqueia a camada nesta sessão; nada é registrado como aceitação. Recarregar limpa isto; contacte o autor se persistir.',
      tou_dismiss_session: 'Dispensar nesta sessão',
      tou_reachable_line: 'Página dos Termos de uso acessível — verificada em {when}.',
      tou_stats_accepted: 'Aceito',
      tou_stats_baseline_length: 'Tamanho da linha de base',
      tou_stats_last_checked: 'Última verificação',
      tou_stats_next_check: 'Próxima verificação',
      tou_stats_pending: 'Pendente…',
      tou_stats_on_next_reload: 'No próximo recarregamento',
      tou_stats_chars: '{n} caracteres',
      tou_force_check: 'Forçar verificação agora',
      tou_checking_url: 'Verificando URL…',
      tou_baseline_saved: 'Linha de base salva!',
      tou_unchanged: 'Inalterado ({variance})',
      tou_revoked: 'WME Open Maps:\n\nOs Termos de uso mudaram em {percent}%!\n\nO consentimento foi revogado. Leia e aceite novamente.',
      notice_dismiss: 'Dispensar',
      tou_gate_banner: '"{title}" foi adicionado. Expanda a linha e aceite os Termos de uso antes de ativar.',
      add_map_pick_hint: 'Abra a lista ou digite para filtrar mapas.',
      reset_terms_button: 'Revogar todos os termos de mapa (recarregar)',
      reset_terms_confirm: 'Revogar todos os Termos de uso guardados? Os mapas afetados ficam bloqueados até aceitar de novo. A página será recarregada.',
      query_window_close: 'Fechar resultados da consulta',
      query_window_minimize: 'Minimizar ou restaurar altura do painel',
      query_results_for: 'Resultados da consulta: {title}',
      tou_gate_add_alert: 'Open Maps — Termos de uso\n\n"{title}" exige que você revise e aceite os termos na barra lateral Open Maps antes de ativar. Expanda este mapa (seta), abra Termos de uso, siga os links e toque em Aceito.\n\nIsso é esperado; o script está funcionando.',
      tou_pending_hint: 'Aceitação dos termos de uso obrigatória',
      no_layers_enabled_hint: 'Nenhuma camada do mapa está ativa. Abra as opções do mapa e ative pelo menos uma camada.',
      layer_origin_curated: 'Curada no script',
      layer_origin_cloud: 'Do catálogo do servidor (nuvem)',
      layer_origin_unknown: 'Fora do script ou do catálogo do servidor',
      layer_origin_default: 'Camada padrão',
      copy_map_definition_tooltip: 'Copiar definição do mapa',
      copy_map_definition_menu_all_keep_defaults: 'Copiar (todas as camadas, manter padrões)',
      copy_map_definition_menu_all_make_enabled_default: 'Copiar (todas as camadas, tornar padrão as ativadas)',
      copy_map_definition_menu_enabled_only_make_default: 'Copiar (somente camadas ativadas, torná-las padrão)',
      copy_done: 'Copiado',
      tou_link_probe_checking: 'A verificar se a página dos termos de uso está acessível…',
      tou_link_probe_ok: 'Página dos termos de uso acessível — verificada em {when}.',
      tou_link_probe_fail: 'A página dos termos de uso não pôde ser carregada ({detail}).',
      tou_accept_disabled_tooltip: 'Abra primeiro cada link de idioma acima.',
      errors: {
        network: 'Erro na rede',
        network_description: 'Recebido o seguinte código de status ao recuperar informações: ',
        see_console: 'Olhe o console da web para mais detalhes',
        timeout: 'Tempo esgostado',
        timeout_description: 'Resgatando resposta demorou mais de 10s, provavelmente problema na rede',
        parse_fail: 'Não foi possível analisar a mensagem de erro'
      },
      areas: {
        AL: 'Albania',
        BE: 'Bélgica',
        BR: 'Brasil',
        LU: 'Luxemburgo',
        NL: 'Países Baixos',
        OM: 'Omã',
        US: 'Estados Unidos',
        HR: 'Croácia',
        CZ: 'Tchéquia',
        UN: 'Universal',
        EU: 'European Union'
      }
    }
  };
  translations['en-GB'] = translations['en-US'] = translations.en;
  I18n.translations[I18n.currentLocale()].openmaps = translations.en;
  Object.keys(translations).forEach(function(locale) {
    if (I18n.currentLocale() == locale) {
      addFallbacks(translations[locale], translations.en);
      I18n.translations[locale].openmaps = translations[locale];
    }
  });
  function addFallbacks(localeStrings, fallbackStrings) {
    Object.keys(fallbackStrings).forEach(function(key) {
      if (!localeStrings[key]) {
        localeStrings[key] = fallbackStrings[key];
      } else if (typeof localeStrings[key] === 'object') {
        addFallbacks(localeStrings[key], fallbackStrings[key]);
      }
    });
  }
  //#endregion


  let maps = new Map();
  [
    {
      id: 9918,
      title: 'Waze Live Traffic (ROW Server)',
      touId: 'waze-internal',
      favicon: true,
      type: 'XYZ',
      url: 'https://www.waze.com/row-tiles/live/base/${z}/${x}/${y}/tile.png',
      crs: 'EPSG:3857',
      bbox: [-179.297176, -14.629169, 179.825647, 71.498685],
      zoomRange: [6, 20],
      format: 'image/png',
      transparent: true,
      area: 'UN',
      tile_size: 256,
      abstract: 'Official Waze Live Map tiles using the Rest-of-World (ROW) production server.',
      attribution: 'Waze / Google',
      queryable: false,
      default_layers: ['waze_live'],
      layers: {
          'waze_live': { queryable: false, title: 'Waze ROW Live Layer' }
      }
    },
    {
      id: 9916,
      title: 'EU Transport Network (TENtec)',
      touId: 'eu-tentec',
      favicon: true,
      type: 'ESRI',
      url: 'https://webgate.ec.europa.eu/getis/rest/services/TENTec/tentec_public_services_ext/MapServer',
      crs: 'EPSG:3857',
      bbox: [-11.0, 34.0, 35.0, 72.0],
      format: 'png32',
      transparent: true,
      area: 'EU',
      abstract: 'European Commission TEN-T Interactive Map (Including Western Balkans)',
      attribution: 'European Commission',
      queryable: true,
      default_layers: [],
      layers: {
          '1': { queryable: true, title: 'Comprehensive Network' },
          '5': { queryable: true, title: 'Urban Nodes' },
          '6': { queryable: true, title: 'Inland Waterways' },
          '7': { queryable: true, title: 'TEN-T Comprehensive Roads' },
          '9': { queryable: true, title: 'Core Network' },
          '11': { queryable: true, title: 'Airports' },
          '13': { queryable: true, title: 'Urban Nodes' },
          '15': { queryable: true, title: 'TEN-T Core Roads' },
          '17': { queryable: true, title: 'EFTA/EEA Countries' },
          '18': { queryable: true, title: 'Comprehensive Network' },
          '24': { queryable: true, title: 'EFTA Comprehensive Roads' },
          '26': { queryable: true, title: 'Core Network' },
          '28': { queryable: true, title: 'Airports' },
          '32': { queryable: true, title: 'EFTA Core Roads' }
      }
    },
    // WWF SIGHT MapServer: .../WMSServer returns HTTP 400 for WMS GetCapabilities/GetMap (WMS not usable here); use ESRI below.
    {
      id: 9920,
      title: 'UNESCO Natural & Mixed World Heritage (WWF SIGHT)',
      touId: 'unesco',
      favicon: false,
      type: 'ESRI',
      url: 'https://wwf-sight-maps.org/arcgis/rest/services/Global/World_Heritage_Sites/MapServer',
      getExternalUrl: () => 'https://experience.arcgis.com/experience/4f1652275d1f4656964b64a20a7346d3',
      crs: 'EPSG:3857',
      bbox: [-179.9999, -85.0, 179.9999, 85.0],
      zoomRange: [1, 22],
      format: 'png32',
      transparent: true,
      area: 'UN',
      tile_size: 256,
      abstract: 'WWF SIGHT service scope is natural and mixed World Heritage (polygons), not the full cultural-property inventory. For broader WH symbology use EEA Maratlas or UNESCO Sites Navigator points.',
      attribution: 'UNESCO World Heritage Centre / WWF SIGHT',
      queryable: true,
      default_layers: ['0'],
      layers: {
          '0': { queryable: true, title: 'World Heritage Sites' }
      }
    },

    
    {
      id: 9921,
      title: 'UNESCO World Heritage (EEA Maratlas) — ArcGIS REST',
      touId: 'unesco',
      favicon: false,
      type: 'ESRI',
      url: 'https://maratlas.discomap.eea.europa.eu/arcgis/rest/services/Maratlas/world_heritage/MapServer',
      getExternalUrl: () => 'https://experience.arcgis.com/experience/4f1652275d1f4656964b64a20a7346d3',
      crs: 'EPSG:3857',
      bbox: [-179.715278, -54.594722, 178.834533, 71.188889],
      zoomRange: [1, 22],
      format: 'png32',
      transparent: true,
      area: 'UN',
      tile_size: 256,
      abstract: 'EEA Maratlas WH map: labels plus point layers split across scale ranges (many sublayers). Defaults enable label + all site point leaves so coverage matches the service at each zoom; hide groups you do not need in the layer list.',
      attribution: 'UNESCO World Heritage Centre / EEA',
      queryable: true,
      // Leaf MapServer ids only (omit group ids 1,4,7,…) so symbols are not drawn twice; include 0 for labels.
      default_layers: ['0', '2', '3', '5', '6', '8', '9', '11', '12', '14', '15', '17', '18', '20', '21', '23', '24', '26', '27'],
      layers: {
          '0': { queryable: true, title: 'World Heritage (labels)' }
      }
    },
    {
      id: 9922,
      title: 'UNESCO World Heritage (EEA Maratlas) — WMS',
      touId: 'unesco',
      favicon: false,
      type: 'WMS',
      url: 'https://maratlas.discomap.eea.europa.eu/arcgis/services/Maratlas/world_heritage/MapServer/WMSServer',
      getExternalUrl: () => 'https://experience.arcgis.com/experience/4f1652275d1f4656964b64a20a7346d3',
      crs: 'EPSG:3857',
      bbox: [-179.715278, -54.594722, 178.834533, 71.188889],
      zoomRange: [1, 22],
      format: 'image/png',
      transparent: true,
      area: 'UN',
      tile_size: 256,
      abstract: 'Same Maratlas content as ArcGIS REST: WMS exposes one layer id per scale band. All are enabled by default so sites appear at any zoom (server still applies scale rules per layer).',
      attribution: 'UNESCO World Heritage Centre / EEA',
      queryable: true,
      default_layers: ['1', '2', '4', '5', '7', '8', '10', '11', '13', '14', '16', '17', '19', '20', '22', '23', '25', '26', '27'],
      layers: {
          '2': { queryable: true, title: 'World Heritage Sites' }
      }
    },
    {
      id: 9923,
      title: 'UNESCO Sites Navigator — Sites (FeatureServer points)',
      touId: 'unesco',
      favicon: false,
      type: 'ESRI_FEATURE',
      // ArcGIS Online hosted FeatureServer (public query). Layer 0 only.
      url: 'https://services7.arcgis.com/iEMmryaM5E3wkdnU/ArcGIS/rest/services/UNESCO/FeatureServer/0',
      getExternalUrl: () => 'https://experience.arcgis.com/experience/4f1652275d1f4656964b64a20a7346d3',
      crs: 'EPSG:3857',
      bbox: [-179.9999, -85.0, 179.9999, 85.0],
      zoomRange: [3, 22],
      // Was 10: WME is often used around z6–9; no features rendered below minVectorZoom.
      minVectorZoom: 3,
      maxFeatures: 750,
      transparent: true,
      area: 'UN',
      abstract: 'Point per listed property (ArcGIS hosted layer). Paste URL must end with …/FeatureServer/0 (no trailing quote). Loads from zoom 3 up; viewport query returns at most maxFeatures points—zoom in for full local coverage.',
      attribution: 'UNESCO World Heritage Centre / ArcGIS (Sites Navigator)',
      queryable: true,
      default_layers: ['0'],
      layers: {
          '0': { queryable: true, title: 'UNESCO Sites (points)' }
      }
    },
    {
      id: 9924,
      title: 'World Heritage Sites — ArcGIS Online (FeatureServer points)',
      touId: 'unesco',
      favicon: false,
      type: 'ESRI_FEATURE',
      url: 'https://services7.arcgis.com/iEMmryaM5E3wkdnU/ArcGIS/rest/services/World_Heritage_Sites/FeatureServer/0',
      getExternalUrl: () => 'https://www.arcgis.com/apps/mapviewer/index.html?url=https://services7.arcgis.com/iEMmryaM5E3wkdnU/ArcGIS/rest/services/World_Heritage_Sites/FeatureServer&source=sd',
      crs: 'EPSG:3857',
      bbox: [-179.9999, -85.0, 179.9999, 85.0],
      zoomRange: [3, 22],
      minVectorZoom: 3,
      maxFeatures: 750,
      transparent: true,
      area: 'UN',
      abstract: 'Point layer hosted on ArcGIS Online (World_Heritage_Sites service). Same query limits as other FeatureServer overlays: zoom 3+, at most maxFeatures per viewport—zoom in locally. Distinct dataset from “UNESCO Sites Navigator” in this catalog.',
      attribution: 'UNESCO World Heritage Centre / ArcGIS Online',
      queryable: true,
      default_layers: ['0'],
      layers: {
          '0': { queryable: true, title: 'World Heritage Sites (points)' }
      }
    },
    {
      id: 9925,
      title: 'World Heritage UNESCO — ArcGIS Online (FeatureServer points)',
      touId: 'unesco',
      favicon: false,
      type: 'ESRI_FEATURE',
      url: 'https://services7.arcgis.com/iEMmryaM5E3wkdnU/ArcGIS/rest/services/World_Heritage_UNESCO/FeatureServer/0',
      getExternalUrl: () => 'https://www.arcgis.com/apps/mapviewer/index.html?url=https://services7.arcgis.com/iEMmryaM5E3wkdnU/ArcGIS/rest/services/World_Heritage_UNESCO/FeatureServer&source=sd',
      crs: 'EPSG:3857',
      bbox: [-179.9999, -85.0, 179.9999, 85.0],
      zoomRange: [3, 22],
      minVectorZoom: 3,
      maxFeatures: 750,
      transparent: true,
      area: 'UN',
      abstract: 'Point layer on ArcGIS Online (World_Heritage_UNESCO service). Same viewport limits as other FeatureServer entries (zoom 3+, maxFeatures cap). Separate from World_Heritage_Sites and from the UNESCO/ Sites Navigator FeatureServer in this catalog.',
      attribution: 'UNESCO World Heritage Centre / ArcGIS Online',
      queryable: true,
      default_layers: ['0'],
      layers: {
          '0': { queryable: true, title: 'World Heritage UNESCO (points)' }
      }
    },
    {
      id: 9914,
      title: 'ASIG Territorial Planning (AKPT)',
      touId: 'al-asig',
      favicon: true,
      type: 'WMS',
      url: 'https://geoportal.asig.gov.al/service/akpt/ows',
      crs: 'EPSG:3857',
      bbox: [19.1545, 39.5737, 21.1595, 42.7463],
      format: 'image/png',
      area: 'AL',
      abstract: 'National Territorial Planning Agency (AKPT) - Master Plans & Zoning',
      attribution: 'ASIG / AKPT',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: [],
      layers: {
          'brezi_bregdetar_krgjsh': { queryable: true, title: 'Coastal Belt' },
          'kategorite_propozuara_perdorimit_te_tokes': { queryable: true, title: 'Proposed land use categories' },
          'kufi_njesie_strukturore_dhe_perdorimi_i_tokes_inspire': { queryable: true, title: 'Structural unit and land use' },
          'plani_gjeohapesinor': { queryable: true, title: 'Spatial Plan' },
          'urbanizimi_publikim': { queryable: true, title: 'Urban Areas' },
      }
    },
    {
      id: 9912,
      title: 'ASIG Cultural Heritage (IKTK)',
      touId: 'al-asig',
      favicon: true,
      type: 'WMS',
      url: 'https://geoportal.asig.gov.al/service/iktk/ows',
      crs: 'EPSG:3857',
      bbox: [19.1545, 39.5737, 21.1595, 42.7463],
      format: 'image/png',
      area: 'AL',
      abstract: 'National Institute of Cultural Heritage (IKTK)',
      attribution: 'ASIG Geoportal',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: [],
      layers: {
          'zm_trashegimisekulturore_012026': { queryable: true, title: 'Cultural protected sites (polygon)' },
          'zonatembrojturatetrashegimisekulturore_pike': { queryable: true, title: 'Cultural protected sites (point)' }
      }
    },
    {
      id: 9911,
      title: 'ASIG Protected Areas (AKZM)',
      touId: 'al-asig',
      favicon: true,
      type: 'WMS',
      url: 'https://geoportal.asig.gov.al/service/akzm/ows',
      crs: 'EPSG:3857',
      bbox: [19.1545, 39.5737, 21.1595, 42.7463],
      format: 'image/png',
      area: 'AL',
      abstract: 'National Agency of Protected Areas (AKZM)',
      attribution: 'ASIG Geoportal',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: [],
      layers: {
          'monumentet_natyrore_07032023': { queryable: true, title: 'Natural monument' }
      }
    },
    {
      id: 9915,
      title: 'ASIG UAV Orthophoto 2024-2025',
      touId: 'al-asig',
      type: 'ESRI',
      url: 'https://basemap.asig.gov.al/server/rest/services/UAV_Orto_2024_2025/MapServer',
      crs: 'EPSG:3857',
      bbox: [19.1545, 39.5737, 21.1595, 42.7463],
      zoomRange: [1, 23],
      format: 'image/png',
      transparent: true,
      area: 'AL',
      tile_size: 512,
      abstract: 'Ultra High-Resolution UAV Orthophotos',
      attribution: 'ASIG',
      queryable: false,
      default_layers: ['uav_orto'],
      layers: {
          'uav_orto': { queryable: false, title: 'Show UAV Imagery' }
      }
    },
    {
      id: 9910,
      title: 'Albania Satellite 2025 (WGS84)',
      touId: 'al-asig',
      type: 'XYZ',
      url: 'https://di-albania-satellite1.img.arcgis.com/arcgis/rest/services/rgb/Albania_2025L3wgs84/MapServer/tile/${z}/${y}/${x}',
      crs: 'EPSG:3857',
      bbox: [19.1545, 39.5737, 21.1595, 42.7463],
      zoomRange: [1, 18],
      format: 'image/png',
      area: 'AL',
      tile_size: 256,
      abstract: 'Albania 2025 Satellite Imagery',
      attribution: 'ASIG / ArcGIS',
      queryable: false,
      default_layers: ['sat_2025_l3'],
      layers: {
          'sat_2025_l3': { queryable: false, title: 'Show Satellite 2025' }
      }
    },
    {
      id: 9908,
      title: 'ASIG Government Services',
      touId: 'al-asig',
      type: 'WMS',
      url: 'https://geoportal.asig.gov.al/service/sherbime_qeveritare/ows',
      crs: 'EPSG:3857',
      bbox: [19.1545, 39.5737, 21.1595, 42.7463],
      format: 'image/png',
      area: 'AL',
      abstract: 'ASIG Government & Public Services (Schools, Hospitals, Police, POIs)',
      attribution: 'ASIG Geoportal',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: [],
      layers: {
          'institucionet_publike_01032024': { queryable: true, title: 'Public Institutions' },
          'inst_shendetesore': { queryable: true, title: 'Health institutions' },
          'sistemii_drejtesise_01032024': { queryable: true, title: 'The Justice System' },
          'albgaz_paisje_stacione': { queryable: true, title: 'Station equipment' },
          'albgaz_pikaevidentimistacione': { queryable: true, title: 'Station registration point' },
          'albgaz_stacione_godina': { queryable: true, title: 'Station Buildings' },
          'albgaz_tubacion': { queryable: true, title: 'Pipe' },
          'albgaz_tubacione_te_brendshme': { queryable: true, title: 'Internal Pipes' },
          'tap_200m_07072021': { queryable: true, title: 'Trans Adriatic Pipeline' },
          'vkm_4_dt_14_10_2020': { queryable: true, title: 'Areas with priority for tourism development' },
          'zona_investimeve_strategjike_amtp': { queryable: true, title: 'Area of Important Strategic Investment' }
      }
    },
    {
      id: 9909,
      title: 'ASIG Hydro & Water Operators',
      touId: 'al-asig',
      type: 'WMS',
      url: 'https://geoportal.asig.gov.al/service/hidro_operator/ows',
      crs: 'EPSG:3857',
      bbox: [19.1545, 39.5737, 21.1595, 42.7463],
      format: 'image/png',
      area: 'AL',
      abstract: 'ASIG Hydrography and Water Utility Operators',
      attribution: 'ASIG Geoportal',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: [],
      layers: {
          'digat_standart_09122021_1': { queryable: true, title: 'Large Dams, 2021' },
          'i_rrjeti_i_rrjedhes_ujore_1': { queryable: true, title: 'Water course link' },
          'ii_pellg_ujembajtes_1': { queryable: true, title: 'Drainage basin' },
          'iii_rrjedhe_ujore_1': { queryable: true, title: 'Water course' },
          'iv_ligatina_2': { queryable: true, title: 'Wetland' }
      }
    },
    {
      id: 9907,
      title: 'ASIG Transport Networks',
      touId: 'al-asig',
      type: 'WMS',
      url: 'https://geoportal.asig.gov.al/service/Rrjete_Transporti/ows',
      crs: 'EPSG:3857',
      bbox: [19.1545, 39.5737, 21.1595, 42.7463],
      format: 'image/png',
      area: 'AL',
      abstract: 'ASIG Transport Networks (Roads, Railways, and Nodes)',
      attribution: 'ASIG Geoportal',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: [],
      layers: {
          'rruge_asig_062025': { queryable: true, title: 'Road Transport Network – Line' },
          'nyje_rruge_asig_062025': { queryable: true, title: 'Road Transport Network – Node' },
      }
    },
    {
      id: 9906,
      title: 'ASIG Cadastre (ZRPP)',
      touId: 'al-asig',
      type: 'WMS',
      url: 'https://geoportal.asig.gov.al/service/zrpp/ows',
      crs: 'EPSG:3857',
      bbox: [19.1545, 39.5737, 21.1595, 42.7463],
      format: 'image/png',
      area: 'AL',
      abstract: 'Immovable Property Registration Office (Cadastre parcels & zones)',
      attribution: 'ASIG Geoportal',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: [],
      layers: {
          'nd_kadastrale_ashk_042025': { queryable: true, title: 'Cadastral Builidings (ASHK)' },
          'ndertesa_qkd_042025': { queryable: true, title: 'Buildings' },
          'p_kadastrale_ashk_042025': { queryable: true, title: 'Cadastral Parcels (ASHK)' },
          'parcela_kadastrale_qkd_042025': { queryable: true, title: 'Cadastral Parcels' },
          'zona_kadastrale_qkd_042025': { queryable: true, title: 'Cadastral Zone' },
      }
    },
    {
      id: 9905,
      title: 'ASIG Basemap 2025',
      touId: 'al-asig',
      type: 'ESRI',
      url: 'https://basemap.asig.gov.al/server/rest/services/Basemap_AL_03_2025/MapServer',
      crs: 'EPSG:3857',
      bbox: [19.1545, 39.5737, 21.1595, 42.7463],
      format: 'image/png',
      area: 'AL',
      tile_size: 512,
      abstract: 'ASIG Basemap (March 2025) - Dynamic ESRI',
      attribution: 'ASIG Geoportal',
      queryable: false,
      default_layers: ['basemap'],
      layers: {
          'basemap': { queryable: false, title: 'Basemap 2025' }
      }
    },
    {
      id: 9904,
      title: 'ASIG Monitoring',
      touId: 'al-asig',
      type: 'WMS',
      url: 'https://geoportal.asig.gov.al/service/monitorime/ows',
      crs: 'EPSG:3857',
      bbox: [19.1545, 39.5737, 21.1595, 42.7463],
      format: 'image/png',
      area: 'AL',
      abstract: 'ASIG Monitoring Layers',
      attribution: 'ASIG Geoportal',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['bregdeti2022'],
      layers: {
          'bregdeti2022': { queryable: true, title: 'Coastal (2022)' }
      }
    },
    {
      id: 9901,
      title: 'ASIG Addresses',
      touId: 'al-asig',
      type: 'WMS',
      url: 'https://geoportal.asig.gov.al/service/adresar/ows',
      crs: 'EPSG:3857',
      bbox: [19.2389, 39.6403, 21.0905, 42.6614],
      format: 'image/png',
      area: 'AL',
      abstract: 'Roads, Buildings and Address Enumerations',
      attribution: 'ASIG Geoportal',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['adr_rruge', 'adr_ndertese', 'adr_numertim'],
      layers: {
          'adr_rruge': { queryable: true, title: 'Roads' },
          'adr_ndertese': { queryable: true, title: 'Buildings' },
          'adr_numertim': { queryable: true, title: 'Enumeration' }
      }
    },
    {
      id: 9902,
      title: 'ASIG Admin Units',
      touId: 'al-asig',
      type: 'WMS',
      url: 'https://geoportal.asig.gov.al/service/kufinjt_e_njesive_administrative/ows',
      crs: 'EPSG:3857',
      bbox: [19.1545, 39.5737, 21.1595, 42.7463],
      format: 'image/png',
      area: 'AL',
      abstract: 'Administrative Boundaries',
      attribution: 'ASIG Geoportal',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: false,
      query_filters: [ applyAllTransformations ],
      default_layers: ['rendi_2_kufi_qarku_vkm360', 'rendi_3_kufi_bashki_vkm360_1'],
      layers: {
          'rendi_1_kufi_shteteror': { queryable: true, title: 'Order 1: State Border' },
          'rendi_2_kufi_qarku_vkm360': { queryable: true, title: 'Order 2: Region Border' },
          'rendi_3_kufi_bashki_vkm360_1': { queryable: true, title: 'Order 3: Municipality Border' },
          '61_bashki_2020': { queryable: true, title: 'Order 3: 61 Municipalities (2020)' },
          'adm_rendi4_bashkiashkoder': { queryable: true, title: 'Order 4: Shkodër' },
          'bashkia_dimal_rendi_4': { queryable: true, title: 'Order 4: Dimal' },
          'bashkia_kamez_rendi4': { queryable: true, title: 'Order 4: Kamëz' },
          'bashkia_mm_rendi4': { queryable: true, title: 'Order 4: Malësi e Madhe' },
          'bashkiapatosrendi4': { queryable: true, title: 'Order 4: Patos' },
          'bashkia_mm_rendi5': { queryable: true, title: 'Order 5: Malësi e Madhe (Towns & Villages)' }
      }
    },
    {
      id: 9903,
      title: 'ASIG Geographical Names',
      touId: 'al-asig',
      type: 'WMS',
      url: 'https://geoportal.asig.gov.al/service/igju/ows',
      crs: 'EPSG:3857',
      bbox: [19.2389, 39.6403, 21.0905, 42.6614],
      format: 'image/png',
      area: 'AL',
      abstract: 'Geographical Names',
      attribution: 'ASIG Geoportal',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: false,
      query_filters: [ applyAllTransformations ],
      default_layers: ['em_gjeo_asig_22102019_1'],
      layers: {
          'em_gjeo_asig_22102019_1': { queryable: false, title: 'Geographical Names (ASIG)' }
      }
    },
    {
      id: 101,
      title: 'WV Leaves Off',
      touId: 'us-wvu',
      type: 'WMS',
      url: 'https://services.wvgis.wvu.edu/arcgis/services/Imagery_BaseMaps_EarthCover/wv_imagery_WVGISTC_leaf_off_mosaic/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [-82.723357, 37.134443, -77.624583, 40.659337],
      format: 'image/jpeg',
      area: 'US',
      abstract: 'Satellite imagery of West Virginia',
      attribution: 'West Virginia University',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: false,
      default_layers: ['1', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '19', '23', '27', '30', '31', '32', '33', '34', '35', '36', '37', '39', '42', '44', '47', '48', '49', '50', '51', '52', '54', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76'],
      layers: {
        '1': { queryable: true, title: 'Mason_2018', abstract: '' },
        '4': { queryable: true, title: 'Gilmer_2019', abstract: '' },
        '5': { queryable: true, title: 'Clay_2019', abstract: '' },
        '6': { queryable: true, title: 'Braxton_2019', abstract: '' },
        '7': { queryable: true, title: 'Pleasants_2020', abstract: '' },
        '8': { queryable: true, title: 'Webster_2020', abstract: '' },
        '9': { queryable: true, title: 'Mingo_2020', abstract: '' },
        '10': { queryable: true, title: 'Boone_2020', abstract: '' },
        '11': { queryable: true, title: 'Pendleton_2021', abstract: '' },
        '12': { queryable: true, title: 'Hancock_2021', abstract: '' },
        '13': { queryable: true, title: 'Randolph_2022', abstract: '' },
        '14': { queryable: true, title: 'Raleigh_2022', abstract: '' },
        '15': { queryable: true, title: 'Marshall_2022', abstract: '' },
        '16': { queryable: true, title: 'Hampshire_2022', abstract: '' },
        '17': { queryable: true, title: 'Wood_2023', abstract: '' },
        '19': { queryable: true, title: 'McDowell_2023', abstract: '' },
        '23': { queryable: true, title: 'Mercer_2024', abstract: '' },
        '27': { queryable: true, title: 'Logan_2024', abstract: '' },
        '30': { queryable: true, title: 'Wirt_2024', abstract: '' },
        '31': { queryable: true, title: 'Wayne_2024', abstract: '' },
        '32': { queryable: true, title: 'Tucker_2024', abstract: '' },
        '33': { queryable: true, title: 'Roane_2024', abstract: '' },
        '34': { queryable: true, title: 'Morgan_2024', abstract: '' },
        '35': { queryable: true, title: 'Marion_2024', abstract: '' },
        '36': { queryable: true, title: 'Hardy_2024', abstract: '' },
        '37': { queryable: true, title: 'Greenbrier_2024', abstract: '' },
        '39': { queryable: true, title: 'Fayette_2024', abstract: '' },
        '42': { queryable: true, title: 'Lincoln_2024', abstract: '' },
        '44': { queryable: true, title: 'Wyoming_2024', abstract: '' },
        '47': { queryable: true, title: 'Monroe_2024', abstract: '' },
        '48': { queryable: true, title: 'Grant_2024', abstract: '' },
        '49': { queryable: true, title: 'Barbour_2024', abstract: '' },
        '50': { queryable: true, title: 'Summers_2024', abstract: '' },
        '51': { queryable: true, title: 'Wetzel_2025', abstract: '' },
        '52': { queryable: true, title: 'Ohio_2025', abstract: '' },
        '54': { queryable: true, title: 'Kanawha_2025', abstract: '' },
        '57': { queryable: true, title: 'Upshur_2025', abstract: '' },
        '58': { queryable: true, title: 'Tyler_2025', abstract: '' },
        '59': { queryable: true, title: 'Taylor_2025', abstract: '' },
        '60': { queryable: true, title: 'Ritchie_2025', abstract: '' },
        '61': { queryable: true, title: 'Putnam_2025', abstract: '' },
        '62': { queryable: true, title: 'Preston_2025', abstract: '' },
        '63': { queryable: true, title: 'Pocahontas_2025', abstract: '' },
        '64': { queryable: true, title: 'Nicholas_2025', abstract: '' },
        '65': { queryable: true, title: 'Monongalia_2025', abstract: '' },
        '66': { queryable: true, title: 'Mineral_2025', abstract: '' },
        '67': { queryable: true, title: 'Lewis_2025', abstract: '' },
        '68': { queryable: true, title: 'Jefferson_2025', abstract: '' },
        '69': { queryable: true, title: 'Jackson_2025', abstract: '' },
        '70': { queryable: true, title: 'Harrison_2025', abstract: '' },
        '71': { queryable: true, title: 'Doddridge_2025', abstract: '' },
        '72': { queryable: true, title: 'Calhoun_2025', abstract: '' },
        '73': { queryable: true, title: 'Cabell_2025', abstract: '' },
        '74': { queryable: true, title: 'Brooke_2025', abstract: '' },
        '75': { queryable: true, title: 'Berkeley_2025', abstract: '' },
        '76': { queryable: true, title: 'CountiesImagery_Year', abstract: '' }
      }
    },
    {
      id: 102,
      title: 'USDA NAIP+ Imagery',
      touId: 'us-usgs',
      type: 'WMS',
      url: 'https://imagery.nationalmap.gov:443/arcgis/services/USGSNAIPPlus/ImageServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [-125.000000, 24.300000, -66.900000, 49.400000],
      format: 'image/png',
      transparent: true,
      area: 'US',
      abstract: 'USDA NAIP+ Imagery of the Continuous US',
      attribution: 'USDA',
      pixelManipulations: ['dirtyWhite2transparent'],
      queryable: false,
      default_layers: ['USGSNAIPPlus'],
      layers: {
        'USGSNAIPPlus': {
          queryable: true,
          title: 'USGSNAIPPlus'
        }
      }
    },
    {
      id: 104,
      title: 'Virginia Aerial Imagery',
      touId: 'us-vgin',
      type: 'WMS',
      url: 'https://vginmaps.vdem.virginia.gov/arcgis/services/VBMP_Imagery/MostRecentImagery_WGS/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [-84.09707, 36.06439, -74.820609, 39.927717],
      format: 'image/jpeg',
      area: 'US',
      abstract: 'Most recent aerial imagery from Virginia Geographic Information Network',
      attribution: 'Virginia Geographic Information Network',
      pixelManipulations: ['vaBlankTiles2Transparent'],
      queryable: false,
      default_layers: ['0'],
      layers: {
        '0': {
          queryable: false,
          title: 'VBMP most recent imagery',
          abstract: 'Orthoimagery collected in Spring 2013, 2014, 2015 and 2017 (whichever is most recently available) by the VBMP program for Virginia. The imagery is displayed in true color (RED, GREEN, BLUE). The spatial reference is WGS 1984 Web Mercator (Auxiliary Sphere). The imagery is tiled at 12 levels from 1:4,622,324 to 1:2,257. The imagery was collected to meet ASPRS Class 1 orthoimagery standards. Most areas were collected at a 1-ft ground sample distance (GSD), with some urban areas upgraded to 6-inch and 3-inch GSD. - "Any determination of topography or contours, or any depiction of physical improvements, property lines or boundaries is for general information only and shall not be used for the design, modification, or construction of improvements to real property or for flood plain determination." Subsection C of § 54.1-402.'
        }
      }
    },
    {
      id: 105,
      title: 'Tennessee Aerial Imagery',
      touId: 'us-tnmap',
      type: 'WMS',
      url: 'https://tnmap.tn.gov/arcgis/services/BASEMAPS/IMAGERY_WEB_MERCATOR/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [-90.350458, 34.961664, -81.609963, 36.686075],
      format: 'image/png',
      area: 'US',
      abstract: 'Tennessee Department of Transportation(TDOT) Imagery Product',
      attribution: 'TDOT',
      queryable: false,
      default_layers: ['0'],
      layers: {
        '0': {
          queryable: false,
          title: 'TDOT Imagery',
          abstract: 'TDOT Imagery Product'
        }
      }
    },
    {
      id: 106,
      title: 'Pennsylvania Aerial Imagery',
      touId: 'us-pasda',
      type: 'WMS',
      url: 'https://apps.pasda.psu.edu/arcgis/services/PEMAImagery2018_WEB/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [-80.589716, 39.679911, -74.682489, 42.29279],
      format: 'image/png',
      area: 'US',
      abstract: 'Aerial Imagery from PEMA, 2018-2020',
      attribution: 'PASDA',
      queryable: false,
      default_layers: ['1', '5', '9', '13', '17', '21', '25', '29', '33', '37', '41', '45', '49', '53', '57', '61', '65', '69', '73', '77', '81', '85', '89', '93', '97', '101', '105', '109', '113', '117', '121', '125', '129', '133', '137', '141', '145', '149', '153', '157', '161', '165', '169', '173', '177', '181', '185', '189', '193', '197', '201', '205', '209', '213', '217'],
      layers: {
        '1': { queryable: true, title: 'Image', abstract: 'PEMA_YorkCounty_Mosaic2018_1' },
        '5': { queryable: true, title: 'Image', abstract: 'PEMA_WyomingCounty_Mosaic2020' },
        '9': { queryable: true, title: 'Image', abstract: 'PEMA_WayneCounty_Mosaic2020' },
        '13': { queryable: true, title: 'Image', abstract: 'PEMA_WashingtonCounty_Mosaic2018' },
        '17': { queryable: true, title: 'Image', abstract: 'PEMA_UnionCounty_Mosaic2020' },
        '21': { queryable: true, title: 'Image', abstract: 'PEMA_SusquehannaCounty_Mosaic2020' },
        '25': { queryable: true, title: 'Image', abstract: 'PEMA_SullivanCounty_Mosaic2020' },
        '29': { queryable: true, title: 'Image', abstract: 'PEMA_SomersetCounty_Mosaic2020' },
        '33': { queryable: true, title: 'Image', abstract: 'PEMA_SnyderCounty_Mosaic2020' },
        '37': { queryable: true, title: 'Image', abstract: 'PEMA_SchuylkillCounty_Mosaic2018' },
        '41': { queryable: true, title: 'Image', abstract: 'PEMA_PotterCounty_Mosaic2020' },
        '45': { queryable: true, title: 'Image', abstract: 'PEMA_PhiladelphiaCounty_Mosaic2018' },
        '49': { queryable: true, title: 'Image', abstract: 'PEMA_PerryCounty_Mosaic2018' },
        '53': { queryable: true, title: 'Image', abstract: 'PEMA_NorthumberlandCounty_Mosaic2018' },
        '57': { queryable: true, title: 'Image', abstract: 'PEMA_NorthamptonCounty_Mosaic' },
        '61': { queryable: true, title: 'Image', abstract: 'PEMA_MontourCounty_Mosaic2018_gdb' },
        '65': { queryable: true, title: 'Image', abstract: 'PEMA_MontgomeryCounty_Mosaic2018' },
        '69': { queryable: true, title: 'Image', abstract: 'PEMA_MonroeCounty_Mosaic2018' },
        '73': { queryable: true, title: 'Image', abstract: 'PEMA_McKeanCounty_Mosaic2019_JP2' },
        '77': { queryable: true, title: 'Image', abstract: 'PEMA_MifflinCounty_Mosaic2020' },
        '81': { queryable: true, title: 'Image', abstract: 'PEMA_LycomingCounty_Mosaic2020' },
        '85': { queryable: true, title: 'Image', abstract: 'PEMA_LuzerneCounty_Mosaic2018' },
        '89': { queryable: true, title: 'Image', abstract: 'PEMA_LehighCounty_Mosaic2018' },
        '93': { queryable: true, title: 'Image', abstract: 'PEMA_LebanonCounty_Mosaic2018' },
        '97': { queryable: true, title: 'Image', abstract: 'PEMA_LawrenceCounty_Mosaic2020' },
        '101': { queryable: true, title: 'Image', abstract: 'PEMA_LancasterCounty_Mosaic2018' },
        '105': { queryable: true, title: 'Image', abstract: 'PEMA_LackawannaCounty_Mosaic2020' },
        '109': { queryable: true, title: 'Image', abstract: 'PEMA_JuniataCounty_Mosaic2020' },
        '113': { queryable: true, title: 'Image', abstract: 'PEMA_JeffersonCounty_Mosaic2018' },
        '117': { queryable: true, title: 'Image', abstract: 'PEMA_HuntingdonCounty_Mosaic2020' },
        '121': { queryable: true, title: 'Image', abstract: 'PEMA_GreeneCounty_Mosaic2018_gdb' },
        '125': { queryable: true, title: 'Image', abstract: 'PEMA_FultonCounty_Mosaic2020' },
        '129': { queryable: true, title: 'Image', abstract: 'PEMA_FranklinCounty_Mosaic2018' },
        '133': { queryable: true, title: 'Image', abstract: 'PEMA_FayetteCounty_Mosaic2020' },
        '137': { queryable: true, title: 'Image', abstract: 'PEMA_ErieCounty_Mosaic2018_JP2' },
        '141': { queryable: true, title: 'Image', abstract: 'PEMA_ElkCounty_Mosaic2019_JP2' },
        '145': { queryable: true, title: 'Image', abstract: 'PEMA_DelawareCounty_Mosaic2018' },
        '149': { queryable: true, title: 'Image', abstract: 'PEMA_DauphinCounty_Mosaic2018' },
        '153': { queryable: true, title: 'Image', abstract: 'PEMA_CumberlandCounty_Mosaic2018_JP2' },
        '157': { queryable: true, title: 'Image', abstract: 'PEMA_CrawfordCounty_Mosaic2018_JP2' },
        '161': { queryable: true, title: 'Image', abstract: 'PEMA_ColumbiaCounty_Mosaic2018' },
        '165': { queryable: true, title: 'Image', abstract: 'PEMA_ClintonCounty_Mosaic2020' },
        '169': { queryable: true, title: 'Image', abstract: 'PEMA_ClearfieldCounty_Mosaic2018' },
        '173': { queryable: true, title: 'Image', abstract: 'PEMA_ChesterCounty_Mosaic2020' },
        '177': { queryable: true, title: 'Image', abstract: 'PEMA_CentreCounty_Mosaic2020' },
        '181': { queryable: true, title: 'Image', abstract: 'PEMA_CarbonCounty_Mosaic2018' },
        '185': { queryable: true, title: 'Image', abstract: 'PEMA_CameronCounty_Mosaic2019_JP2' },
        '189': { queryable: true, title: 'Image', abstract: 'PEMA_CambriaCounty_Mosaic2018' },
        '193': { queryable: true, title: 'Image', abstract: 'PEMA_BucksCounty_Mosaic' },
        '197': { queryable: true, title: 'Image', abstract: 'PEMA_BradfordCounty_Mosaic2020' },
        '201': { queryable: true, title: 'Image', abstract: 'PEMA_BlairCounty_Mosaic2020' },
        '205': { queryable: true, title: 'Image', abstract: 'PEMA_BerksCounty_Mosaic2020' },
        '209': { queryable: true, title: 'Image', abstract: 'PEMA_BeaverCounty_Mosaic2020' },
        '213': { queryable: true, title: 'Image', abstract: 'PEMA_AlleghenyCounty_Mosaic2018' },
        '217': { queryable: true, title: 'Image', abstract: 'PEMA_AdamsCounty_Mosaic2018_JP2' }
      }
    },
    {
      id: 107,
      title: 'USDA NAIP+ Puerto Rico',
      touId: 'us-usgs',
      type: 'WMS',
      url: 'https://services.nationalmap.gov/arcgis/services/USGSNAIPPlus/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [-67.95584, 17.865141, -65.21849, 18.522609],
      format: 'image/png',
      area: 'US',
      abstract: 'USDA NAIP+ Imagery of Puerto Rico',
      attribution: 'USDA',
      queryable: false,
      default_layers: ['1'],
      layers: {
        '1': { queryable: false, title: 'USDA NAIP+ Puerto Rico', abstract: 'USDA NAIP+ Imagery of the Puerto Rico' }
      }
    },
    {
      id: 108,
      title: 'USDA NAIP+ Virgin Islands',
      touId: 'us-usgs',
      type: 'WMS',
      url: 'https://services.nationalmap.gov/arcgis/services/USGSNAIPPlus/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [-65.077787, 17.654595, -64.546763, 18.427245],
      format: 'image/png',
      area: 'US',
      abstract: 'USDA NAIP+ Imagery of Virgin Islands',
      attribution: 'USDA',
      queryable: false,
      default_layers: ['5'],
      layers: {
        '5': { queryable: false, title: 'USDA NAIP+ Virgin Islands', abstract: 'USDA NAIP+ Imagery of the Virgin Islands' }
      }
    },
    {
      id: 109,
      title: 'USDA NAIP+ Hawaii',
      touId: 'us-usgs',
      type: 'WMS',
      url: 'https://services.nationalmap.gov/arcgis/services/USGSNAIPPlus/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [-160.678325, 17.356606, -152.847819, 23.203373],
      format: 'image/png',
      area: 'US',
      abstract: 'USDA NAIP+ Imagery of Hawaii',
      attribution: 'USDA',
      queryable: false,
      default_layers: ['9'],
      layers: {
        '9': { queryable: false, title: 'USDA NAIP+ Hawaii', abstract: 'USDA NAIP+ Imagery of the Hawaii' }
      }
    },
    {
      id: 110,
      title: 'USDA NAIP+ American Samoa',
      touId: 'us-usgs',
      type: 'WMS',
      url: 'https://services.nationalmap.gov/arcgis/services/USGSNAIPPlus/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [-170.851656, -14.377607, -169.40573, -14.143065],
      format: 'image/png',
      area: 'US',
      abstract: 'USDA NAIP+ Imagery of American Samoa',
      attribution: 'USDA',
      queryable: false,
      default_layers: ['13'],
      layers: {
        '13': { queryable: false, title: 'USDA NAIP+ American Samoa', abstract: 'USDA NAIP+ Imagery of the American Samoa' }
      }
    },
    {
      id: 111,
      title: 'USDA NAIP+ Guam/Northern Mariana Islands',
      touId: 'us-usgs',
      type: 'WMS',
      url: 'https://services.nationalmap.gov/arcgis/services/USGSNAIPPlus/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [144.549128, 13.165851, 146.125274, 20.625758],
      format: 'image/png',
      area: 'US',
      abstract: 'USDA NAIP+ Imagery of Guam/Northern Mariana Islands',
      attribution: 'USDA',
      queryable: false,
      default_layers: ['17'],
      layers: {
        '17': { queryable: false, title: 'USDA NAIP+ Guam/Northern Mariana Islands', abstract: 'USDA NAIP+ Imagery of the Guam/Northern Mariana Islands' }
      }
    },
    {
      id: 112,
      title: 'USDA NAIP+ St. John',
      touId: 'us-usgs',
      type: 'WMS',
      url: 'https://services.nationalmap.gov/arcgis/services/USGSNAIPPlus/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [-64.806465, 18.268151, -64.635387, 18.37756],
      format: 'image/png',
      area: 'US',
      abstract: 'USDA NAIP+ Imagery of St. John',
      attribution: 'USDA',
      queryable: false,
      default_layers: ['21'],
      layers: {
        '21': { queryable: false, title: 'USDA NAIP+ St. John', abstract: 'USDA NAIP+ Imagery of the St. John' }
      }
    },
    {
      id: 113,
      title: 'USDA NAIP+ Alaska',
      touId: 'us-usgs',
      type: 'WMS',
      url: 'https://services.nationalmap.gov/arcgis/services/USGSNAIPPlus/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [-173.25, 54.383756, -129.786987, 71.506811],
      format: 'image/png',
      area: 'US',
      abstract: 'USDA NAIP+ Imagery of Alaska',
      attribution: 'USDA',
      queryable: false,
      default_layers: ['29'],
      layers: {
        '29': { queryable: false, title: 'USDA NAIP+ Alaska', abstract: 'USDA NAIP+ Imagery of the Alaska' }
      }
    },
    {
      id: 114,
      title: 'NC OneMap',
      touId: 'us-nconemap',
      type: 'WMS',
      url: 'https://services.nconemap.gov/secure/services/Imagery/Orthoimagery_Latest/ImageServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [-84.262261, 33.695574, -75.399761, 36.590526],
      format: 'image/png',
      area: 'US',
      abstract: 'Most recent aerial imagery from NC OneMap',
      attribution: 'NC OneMap',
      queryable: false,
      default_layers: ['0'],
      layers: {
        '0': { queryable: false, title: 'Orthoimagery_Latest', abstract: 'Imagery/Orthoimagery_Latest' }
      }
    },
    {
      id: 115,
      title: 'IndianaMap',
      touId: 'us-indianamap',
      type: 'WMS',
      url: 'https://di-ingov.img.arcgis.com/arcgis/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [-88.165560, 37.762766, -84.698567, 41.813054],
      format: 'image/png',
      area: 'US',
      abstract: 'State of Indiana Current Orthophotography',
      attribution: 'IndianaMap',
      queryable: false,
      default_layers: ['Indiana_Current_Imagery'],
      layers: {
        'Indiana_Current_Imagery': { queryable: false, title: 'Indiana_Current_Imagery', abstract: 'Indiana_Current_Imagery' }
      }
    },
    {
      id: 116,
      title: 'Maryland iMAP Three-Inch',
      touId: 'us-mdimap',
      type: 'WMS',
      url: 'https://mdgeodata.md.gov/imagery/services/ThreeInch/MD_ThreeInchImagery/ImageServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [-77.265544, 37.943615, -75.031378, 39.737316],
      format: 'image/png',
      area: 'US',
      abstract: 'Three-inch imagery from Maryland iMAP',
      attribution: 'MD iMAP',
      queryable: false,
      default_layers: ['MD_ThreeInchImagery'],
      layers: {
        'MD_ThreeInchImagery': { queryable: false, title: 'MD_ThreeInchImagery', abstract: 'MD_ThreeInchImagery' }
      }
    },
    {
      id: 117,
      title: 'Maryland iMAP Six-Inch',
      touId: 'us-mdimap',
      type: 'WMS',
      url: 'https://mdgeodata.md.gov/imagery/services/SixInch/SixInchImagery/ImageServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [-79.507413, 37.880890, -75.031378, 39.737316],
      format: 'image/png',
      area: 'US',
      abstract: 'Six-inch imagery from Maryland iMAP',
      attribution: 'MD iMAP',
      queryable: false,
      default_layers: ['SixInchImagery'],
      layers: {
        'SixInchImagery': { queryable: false, title: 'SixInchImagery', abstract: 'SixInchImagery' }
      }
    },
    {
      id: 3101,
      title: 'BAG',
      touId: 'nl-pdok',
      type: 'WMS',
      url: 'https://service.pdok.nl/lv/bag/wms/v2_0',
      crs: 'EPSG:3857',
      bbox: [3.206231, 50.733604, 7.245263, 53.58298],
      format: 'image/png',
      area: 'NL',
      abstract: 'De gegevens bestaan uit BAG-panden en een deelselectie van BAG-gegevens van deze panden en de zich daarin bevindende verblijfsobjecten.',
      attribution: 'BAG',
      getExternalUrl: () => 'https://bagviewer.kadaster.nl/lvbag/bag-viewer/index.html',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['verblijfsobject'],
      layers: {
        'verblijfsobject': { queryable: true, title: 'verblijfsobject' },
        'ligplaats': { queryable: false, title: 'ligplaats' },
        'pand': { queryable: false, title: 'pand' },
        'standplaats': { queryable: false, title: 'standplaats' },
        'woonplaats': { queryable: false, title: 'woonplaats' }
      }
    },
    {
      id: 3103,
      title: 'Weggegevens',
      touId: 'nl-pdok',
      type: 'WMS',
      url: 'https://service.pdok.nl/rws/weggeg/wms/v1_0',
      crs: 'EPSG:3857',
      bbox: [3.460993, 50.740995, 7.239002, 53.443005],
      format: 'image/png',
      area: 'NL',
      abstract: 'De service van Weggegevens bevat op dit moment de lagen maximum snelheden en rijstroken van de rijkswegen.',
      attribution: 'PDOK',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['WegvakRijstroken', 'WegvakMaxSnelheden'],
      layers: {
        'WegvakRijstroken': { queryable: true, title: 'Weggegevens aantal rijbanen' },
        'WegvakMaxSnelheden': { queryable: true, title: 'Weggegevens maximumsnelheden' }
      }
    },
    {
      id: 3105,
      title: 'Nationaal Wegen Bestand',
      touId: 'nl-pdok',
      type: 'WMS',
      url: 'https://service.pdok.nl/rws/nwbwegen/wms/v1_0',
      crs: 'EPSG:3857',
      bbox: [3.000000, 50.740995, 7.000000, 53.000000],
      zoomRange: [14, 22],
      format: 'image/png',
      area: 'NL',
      abstract: 'Deze dataset bevat alleen de wegvakken en hectometerpunten.',
      attribution: 'PDOK',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['hectopunten', 'wegvakken'],
      layers: {
        'hectopunten': { queryable: true, title: 'NWB Wegen hectopunten', abstract: 'Deze laag bevat de hectopunten' },
        'wegvakken': { queryable: true, title: 'NWB Wegen wegvakken', abstract: 'Deze laag bevat de wegvakken' }
      }
    },
    {
      id: 3106,
      title: 'Luchtfoto (PDOK)',
      touId: 'nl-pdok',
      type: 'WMS',
      url: 'https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0',
      crs: 'EPSG:3857',
      bbox: [-1.657293, 48.040499, 12.431731, 56.110592],
      format: 'image/jpeg',
      area: 'NL',
      abstract: 'Een jaarlijks te vernieuwen dataset van luchtopnamen van Nederland in hoge en lage resolutie.',
      attribution: 'PDOK',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: false,
      default_layers: ['Actueel_orthoHR'],
      layers: {
        'Actueel_orthoHR': { queryable: false, title: 'Luchtfoto Actueel HR', abstract: 'Landsdekkende dataset in 8cm resolutie' },
        'Actueel_ortho25': { queryable: false, title: 'Luchtfoto Actueel 25cm', abstract: 'Landsdekkende 25cm resolutie dataset' },
        '2025_orthoHR': { queryable: false, title: 'Luchtfoto 2025 Ortho 8cm RGB', abstract: 'Landsdekkende dataset in 8cm resolutie' },
        '2025_ortho25': { queryable: false, title: 'Luchtfoto 2025 Ortho 25cm RGB', abstract: 'Landsdekkende dataset in 25cm resolutie' },
        '2024_orthoHR': { queryable: false, title: 'Luchtfoto 2024 Ortho 8cm RGB', abstract: 'Landsdekkende dataset in 8cm resolutie' },
        '2023_orthoHR': { queryable: false, title: 'Luchtfoto 2023 Ortho HR', abstract: 'Landsdekkende dataset in hoge resolutie' },
        '2023_ortho25': { queryable: false, title: 'Luchtfoto 2023 Ortho 25cm RGB', abstract: 'Landsdekkende dataset 25cm resolutie' },
        '2022_orthoHR': { queryable: false, title: 'Luchtfoto 2022 Ortho HR', abstract: 'Landsdekkende dataset in hoge resolutie' },
        '2022_ortho25': { queryable: false, title: 'Luchtfoto 2022 Ortho 25cm RGB', abstract: 'Landsdekkende dataset 25cm resolutie' },
        '2021_orthoHR': { queryable: false, title: 'Luchtfoto 2021 Ortho HR', abstract: 'Landsdekkende dataset in hoge resolutie' },
        '2020_ortho25': { queryable: false, title: 'Luchtfoto 2020 Ortho 25cm RGB', abstract: 'Landsdekkende dataset 25cm resolutie' },
        '2019_ortho25': { queryable: false, title: 'Luchtfoto 2019 Ortho 25cm RGB', abstract: 'Landsdekkende dataset 25cm resolutie' },
        '2018_ortho25': { queryable: false, title: 'Luchtfoto 2018 Ortho 25cm RGB', abstract: 'Landsdekkende dataset 25cm resolutie' },
        '2017_ortho25': { queryable: false, title: 'Luchtfoto 2017 Ortho 25cm RGB', abstract: 'Landsdekkende dataset 25cm resolutie' },
        '2016_ortho25': { queryable: false, title: 'Luchtfoto 2016 Ortho 25cm RGB', abstract: 'Landsdekkende dataset 25cm resolutie' }
      }
    },
    {
      id: 3107,
      title: 'Kadastrale kaart',
      touId: 'nl-pdok',
      type: 'WMS',
      url: 'https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0',
      crs: 'EPSG:3857',
      bbox: [3.460993, 50.740995, 7.239002, 53.443005],
      format: 'image/png',
      area: 'NL',
      abstract: 'Overzicht van de ligging van de kadastrale percelen in Nederland.',
      attribution: 'PDOK',
      pixelManipulations: ['removePartialBlackTransparency', 'traceGrayscalePixels'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['KadastraleKaart'],
      layers: {
        'KadastraleKaart': { queryable: true, title: 'Kadastrale kaart', abstract: 'Bevat alle andere kaartlagen' },
        'Bebouwing': { queryable: true, title: 'Bebouwing', abstract: 'Bevat Bebouwingsvlak en Nummeraanduidingsreeks' },
        'Bebouwingvlak': { queryable: true, title: 'Bebouwingvlak' },
        'Nummeraanduidingreeks': { queryable: true, title: 'Nummeraanduidingreeks' },
        'OpenbareRuimteNaam': { queryable: true, title: 'Naam openbare ruimte' },
        'Perceel': { queryable: true, title: 'Perceel', abstract: 'Bevat Perceelvlak, Label en Bijpijling.' },
        'Perceelvlak': { queryable: true, title: 'Perceelvlak' },
        'Label': { queryable: true, title: 'Label perceel' },
        'Bijpijling': { queryable: true, title: 'Bijpijling' },
        'KadastraleGrens': { queryable: true, title: 'Kadastrale grens' }
      }
    },
    {
      id: 3108,
      title: 'Maximumsnelheden',
      touId: 'nl-rws',
      type: 'WMS',
      url: 'https://geo.rijkswaterstaat.nl/services/ogc/gdr/maximum_snelheden_wegen/ows',
      crs: 'EPSG:3857',
      bbox: [3.253348, 50.73394, 7.246081, 53.549177],
      format: 'image/png',
      area: 'NL',
      abstract: 'Maximumsnelhedenkaart van alle wegen in Nederland, voorzien door Rijkswaterstaat',
      attribution: 'Rijkswaterstaat',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['max_snelheden_overdag', 'max_snelheden_nacht'],
      layers: {
        'max_snelheden_overdag': { title: 'Maximumsnelheden overdag', queryable: true },
        'max_snelheden_nacht': { title: 'Maximumsnelheden \'s nachts', queryable: true },
        'max_snelheden_advies': { title: 'Adviessnelheden per wegvak', queryable: true }
      }
    },
    {
      id: 3201,
      title: 'GRB Vlaanderen',
      touId: 'be-vlaanderen',
      type: 'WMS',
      url: 'https://geo.api.vlaanderen.be/GRB/wms',
      crs: 'EPSG:3857',
      bbox: [2.519999, 50.639999, 5.940002, 51.510003],
      format: 'image/png',
      area: 'BE',
      abstract: 'Opvragen en visualiseren van het Grootschalig Referentiebestand (GRB) als een kaart.',
      attribution: 'Agentschap Informatie Vlaanderen',
      getExternalUrl: (extent) => 'http://www.geopunt.be/kaart?app=Geopunt-kaart_app&kaart=Basiskaart - GRB: volledige kaart&extent=' + extent.left + ',' + extent.right + ',' + extent.bottom + ',' + extent.top,
      queryable: false,
      default_layers: ['GRB_BSK'],
      layers: {
        'GRB_BSK': { queryable: false, title: 'GRB-basiskaart', abstract: 'Deze laag omvat alle (GRB-) entiteiten' }
      }
    },
    {
      id: 3202,
      title: 'Orthomozaïek Vlaanderen',
      touId: 'be-vlaanderen',
      type: 'WMS',
      url: 'https://geo.api.vlaanderen.be/OMWRGBMRVL/wms',
      crs: 'EPSG:3857',
      bbox: [2.519999, 50.639999, 5.940002, 51.510003],
      format: 'image/jpeg',
      area: 'BE',
      abstract: 'WMS die de compilatie weergeeft van de meest recente middenschalige orthofotomozaïeken',
      attribution: 'Agentschap Informatie Vlaanderen',
      pixelManipulations: ['whiteTiles2transparent'],
      getExternalUrl: (extent) => 'http://www.geopunt.be/kaart?app=Geopunt-kaart_app&kaart=Opnamedatum meest recente luchtfoto in achtergrondkaart&extent=' + extent.left + ',' + extent.right + ',' + extent.bottom + ',' + extent.top,
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['Ortho', 'Vliegdagcontour'],
      layers: {
        'Ortho': { queryable: false, title: 'Orthofotomozaïek, middenschalig', abstract: 'Deze rasterlaag is een compilatie van de meest recente orthofotomozaëken' },
        'Vliegdagcontour': { queryable: true, title: 'Vliegdagcontour Orthofotomozaïek', abstract: 'Vectorlaag die opnamedatum weergeeft.' }
      }
    },
    {
      id: 3203,
      title: 'PICC, Service de visualisation',
      touId: 'be-wallonie',
      type: 'WMS',
      url: 'https://geoservices.wallonie.be/arcgis/services/TOPOGRAPHIE/PICC_VDIFF/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [2.654315, 49.426121, 6.651405, 51.110628],
      zoomRange: [15, 22],
      wmsMinEffectiveZoom: 17,
      format: 'image/png',
      area: 'BE',
      abstract: 'Service de visualisation du Projet Informatique de Cartographie Continue (PICC)',
      attribution: 'Service public de Wallonie',
      pixelManipulations: ['traceGrayscalePixels'],
      getExternalUrl: () => 'http://geoportail.wallonie.be/walonmap',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['1', '3', '4', '5', '7', '9', '10', '11', '12', '13', '14', '16', '17', '18', '19', '21', '22', '23', '24', '26', '27', '28', '29', '30', '31', '32'],
      layers: {
        '1': { queryable: true, title: 'Relief: ligne' },
        '3': { queryable: true, title: 'Hydrographie: emprise' },
        '4': { queryable: true, title: 'Hydrographie: bord' },
        '5': { queryable: true, title: 'Hydrographie: axe' },
        '7': { queryable: true, title: 'Reseau ferroviaire: ligne' },
        '9': { queryable: true, title: 'Voirie: surface' },
        '10': { queryable: true, title: 'Voirie: axe (>= 50k)' },
        '11': { queryable: true, title: 'Voirie: axe (5k-50k)' },
        '12': { queryable: true, title: 'Voirie: axe' },
        '13': { queryable: true, title: 'Voirie: ligne' },
        '14': { queryable: true, title: 'Voirie: noeud' },
        '16': { queryable: true, title: 'Occupation du sol: surface' },
        '17': { queryable: true, title: 'Occupation du sol: bord' },
        '18': { queryable: true, title: 'Occupation du sol: ligne' },
        '19': { queryable: true, title: 'Occupation du sol: point' },
        '21': { queryable: true, title: 'Construction: emprise d\'ouvrage d\'art' },
        '22': { queryable: true, title: 'Construction: emprise du batiment' },
        '23': { queryable: true, title: 'Construction: ouvrage d\'art: bord' },
        '24': { queryable: true, title: 'Construction: bord du batiment' },
        '26': { queryable: true, title: 'Equipement: surface' },
        '27': { queryable: true, title: 'Equipement: axe' },
        '28': { queryable: true, title: 'Equipement: ligne' },
        '29': { queryable: true, title: 'Equipement: point' },
        '30': { queryable: true, title: 'Symbologie' },
        '31': { queryable: true, title: 'Adresses' },
        '32': { queryable: true, title: 'Toponymie' }
      }
    },
    {
      id: 3204,
      title: 'Brussels CIRB (NL)',
      touId: 'be-urbis',
      type: 'WMS',
      url: 'https://geoservices-urbis.irisnet.be/geoserver/BaseMaps/ows',
      crs: 'EPSG:31370',
      bbox: [4.236257, 50.760569, 4.487579, 50.915368],
      format: 'image/png',
      area: 'BE',
      abstract: 'Brusselse kaartgegevens',
      attribution: 'Irisnet GIS',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['BaseMaps:UrbISDutchLabeledColor'],
      layers: {
        'BaseMaps:UrbISDutchLabeledColor': { queryable: false, title: 'Urbis Base Map NL', abstract: 'This layer represents the base map in dutch.' },
        'BaseMaps:UrbISDutchLabeledGray': { queryable: false, title: 'Urbis Base Map Gray NL', abstract: 'This layer represents the gray base map in dutch.' },
        'urbisvector:StreetAxes': { queryable: true, title: 'Labeled Street Axe' },
        'urbisvector:StreetAxes_Underground': { queryable: true, title: 'Labeled Street Axe Underground' },
        'inspire:AD.Address': { queryable: true, title: 'Address points (INSPIRE)' },
        'urbisvector:AddressNumbers': { queryable: true, title: 'Address points' },
        'inspire:Bu': { queryable: true, title: 'Buildings (INSPIRE)' },
        'urbisvector:Buildings': { queryable: true, title: 'Buildings' },
        'urbisvector:MonitoringDistricts': { queryable: true, title: 'Monitoring districts' },
        'urbisvector:Municipalities': { queryable: true, title: 'Municipalities' },
        'urbisvector:StreetSurfaces': { queryable: false, title: 'Street surfaces' },
        'urbisvector:StreetSurfaces_Underground': { queryable: false, title: 'Street surfaces Underground' },
        'urbisvector:Region': { queryable: false, title: 'Region' },
        'urbisvector:StatisticalSectors': { queryable: true, title: 'Statistical sectors' },
        'urbisvector:StreetNodes': { queryable: false, title: 'Street nodes' },
        'urbisvector:TrainNetwork': { queryable: false, title: 'Rail tracks' },
        'urbisvector:TrainNetwork_Underground': { queryable: false, title: 'Rail tracks Underground' },
        'inspire:GN.GeographicalNames': { queryable: true, title: 'Geographical Names' },
        'urbisvector:PointsOfInterest': { queryable: true, title: 'Points of interest' },
        'urbistopo:TopoLines': { queryable: false, title: 'Urbis Topo Lines' },
        'urbistopo:TopoPoints': { queryable: true, title: 'Urbis Topo Points' }
      }
    },
    {
      id: 3206,
      title: 'Ortho Vlaanderen Tijdsreeksen',
      touId: 'be-vlaanderen',
      type: 'WMS',
      url: 'https://geo.api.vlaanderen.be/OMW/wms',
      crs: 'EPSG:3857',
      bbox: [2.519999, 50.639999, 5.940002, 51.510003],
      format: 'image/jpeg',
      area: 'BE',
      abstract: 'Tijdsreeks van middenschalige orthofotomozaïeken met een resolutie van 25cm, gebiedsdekkend voor Vlaanderen',
      attribution: 'Agentschap Informatie Vlaanderen',
      pixelManipulations: ['whiteTiles2transparent'],
      getExternalUrl: (extent) => 'http://www.geopunt.be/kaart?app=Geopunt-kaart_app&extent=' + extent.left + ',' + extent.right + ',' + extent.bottom + ',' + extent.top,
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['OMWRGB22VL', 'OMWRGB22VL_VDC'],
      layers: {
        'OMWRGB22VL': { queryable: false, title: 'Winteropnamen, 2022' },
        'OMWRGB22VL_VDC': { queryable: true, title: 'Winteropnamen, 2022, vliegdagcontour' },
        'OMWRGB21VL': { queryable: false, title: 'Winteropnamen, 2021' },
        'OMWRGB21VL_VDC': { queryable: true, title: 'Winteropnamen, 2021, vliegdagcontour' },
        'OMWRGB20VL': { queryable: false, title: 'Winteropnamen, 2020' },
        'OMWRGB20VL_VDC': { queryable: true, title: 'Winteropnamen, 2020, vliegdagcontour' },
        'OMWRGB19VL': { queryable: false, title: 'Winteropnamen, 2019' },
        'OMWRGB19VL_VDC': { queryable: true, title: 'Winteropnamen, 2019, vliegdagcontour' },
        'OMWRGB18VL': { queryable: false, title: 'Winteropnamen, 2018' },
        'OMWRGB18VL_VDC': { queryable: true, title: 'Winteropnamen, 2018, vliegdagcontour' },
        'OMWRGB17VL': { queryable: false, title: 'Winteropnamen, 2017' },
        'OMWRGB17VL_VDC': { queryable: true, title: 'Winteropnamen, 2017, vliegdagcontour' },
        'OMWRGB16VL': { queryable: false, title: 'Winteropnamen, 2016' },
        'OMWRGB16VL_VDC': { queryable: true, title: 'Winteropnamen, 2016, vliegdagcontour' },
        'OMWRGB15VL': { queryable: false, title: 'Winteropnamen, 2015' },
        'OMWRGB15VL_VDC': { queryable: true, title: 'Winteropnamen, 2015, vliegdagcontour' },
        'OMWRGB14VL': { queryable: false, title: 'Winteropnamen, 2014' },
        'OMWRGB14VL_VDC': { queryable: true, title: 'Winteropnamen, 2014, vliegdagcontour' },
        'OMWRGB13VL': { queryable: false, title: 'Winteropnamen, 2013' },
        'OMWRGB13VL_VDC': { queryable: true, title: 'Winteropnamen, 2013, vliegdagcontour' },
        'OMWRGB12VL': { queryable: false, title: 'Winteropnamen, 2012' },
        'OMWRGB12VL_VDC': { queryable: true, title: 'Winteropnamen, 2012, vliegdagcontour' },
        'OMWRGB08_11VL': { queryable: false, title: 'Winteropnamen, 2008-2011' },
        'OMWRGB08_11VL_VDC': { queryable: true, title: 'Winteropnamen, 2008-2011, vliegdagcontour' },
        'OMWRGB05_07VL': { queryable: false, title: 'Winteropnamen, 2005-2007' },
        'OMWRGB05_07VL_VDC': { queryable: true, title: 'Winteropnamen, 2005-2007, vliegdagcontour' },
        'OMWRGB00_03VL': { queryable: false, title: 'Winteropnamen, 2000-2003' },
        'OMWRGB00_03VL_VDC': { queryable: true, title: 'Winteropnamen, 2000-2003, vliegdagcontour' }
      }
    },
    {
      id: 3207,
      title: 'Wegenregister',
      touId: 'be-vlaanderen',
      type: 'WMS',
      url: 'https://geo.api.vlaanderen.be/Wegenregister/wms',
      crs: 'EPSG:3857',
      bbox: [2.519999, 50.639999, 5.939993, 51.509997],
      format: 'image/png',
      area: 'BE',
      abstract: 'De wegen in het Wegenregister.',
      attribution: 'Agentschap Informatie Vlaanderen',
      getExternalUrl: (extent) => 'http://www.geopunt.be/kaart?app=Geopunt-kaart_app&kaart=wegennet&extent=' + extent.left + ',' + extent.right + ',' + extent.bottom + ',' + extent.top,
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['AUTOSWEG', 'WEGGESCH', 'WEGEEN', 'ROT', 'SPECSIT', 'VERKPLEIN', 'OPAFOGKR', 'OPAFGGKR', 'PLLWEG', 'VENTWEG', 'INUITP', 'INUITD', 'VOETGANGERSZONE', 'WANDFIETS', 'TRAMWEG', 'DIENSTWEG', 'AARDEWEG', 'VEER', 'TYPENTG', 'LABELS'],
      layers: {
        'AUTOSWEG': { queryable: true, title: 'Autosnelweg' },
        'WEGGESCH': { queryable: true, title: 'Weg met gescheiden rijbanen' },
        'WEGEEN': { queryable: true, title: 'Weg met één rijbaan' },
        'ROT': { queryable: true, title: 'Rotonde' },
        'SPECSIT': { queryable: true, title: 'Speciale verkeerssituatie' },
        'VERKPLEIN': { queryable: true, title: 'Verkeersplein' },
        'OPAFOGKR': { queryable: true, title: 'Oprit of afrit behorende tot een nietgelijkgrondse kruising' },
        'OPAFGGKR': { queryable: true, title: 'Oprit of afrit behorende tot een gelijkgrondse kruising' },
        'PLLWEG': { queryable: true, title: 'Parallelweg' },
        'VENTWEG': { queryable: true, title: 'Ventweg' },
        'INUITP': { queryable: true, title: 'Inrit of uitrit van een parking' },
        'INUITD': { queryable: true, title: 'Inrit of uitrit van een dienst' },
        'VOETGANGERSZONE': { queryable: true, title: 'Voetgangerszone' },
        'WANDFIETS': { queryable: true, title: 'Wandel- of fietsweg' },
        'TRAMWEG': { queryable: true, title: 'Tramweg' },
        'DIENSTWEG': { queryable: true, title: 'Dienstweg' },
        'AARDEWEG': { queryable: true, title: 'Aardeweg' },
        'VEER': { queryable: true, title: 'Veer' },
        'TYPENTG': { queryable: true, title: 'Type weg niet gekend' },
        'LABELS': { queryable: false, title: 'Straatnamen' }
      }
    },
    {
      id: 3208,
      title: 'Administratieve eenheden',
      touId: 'be-vlaanderen',
      type: 'WMS',
      url: 'https://geo.api.vlaanderen.be/Administratieve_Eenheden/wms',
      crs: 'EPSG:3857',
      bbox: [2.519999, 50.639999, 5.939993, 51.509997],
      format: 'image/png',
      area: 'BE',
      abstract: 'Vlaamse administratieve eenheden',
      attribution: 'AIV',
      pixelManipulations: ['traceGrayscalePixels'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['Refarr', 'Refprv', 'Refgew', 'RefgemGrens', 'RefgemBron', 'RefgemLabel'],
      layers: {
        'Refgem': { queryable: true, title: 'Gemeenten' },
        'Refarr': { queryable: true, title: 'Arrondissementen - Grenzen' },
        'Refprv': { queryable: true, title: 'Provincies - Grenzen' },
        'Refgew': { queryable: true, title: 'Gewest - Grens' },
        'RefgemGrens': { queryable: true, title: 'Gemeenten - Grenzen' },
        'RefgemBron': { queryable: true, title: 'Gemeenten - Grenzen - Bron Geometrie' },
        'RefgemLabel': { queryable: true, title: 'Gemeenten - Namen' }
      }
    },
    {
      id: 3209,
      title: 'Orthofotowerkbestand Vlaanderen',
      touId: 'be-vlaanderen',
      type: 'WMS',
      url: 'https://geo.api.vlaanderen.be/ofw/wms',
      crs: 'EPSG:3857',
      bbox: [2.519999, 50.639999, 5.940002, 51.510003],
      format: 'image/jpeg',
      area: 'BE',
      abstract: 'Compilatie van de meest recente orthofotowerkbestanden voor Vlaanderen',
      attribution: 'Agentschap Informatie Vlaanderen',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['OFW', 'OFW_vdc'],
      layers: {
        'OFW': { queryable: false, title: 'Orthofotowerkbestand' },
        'OFW_vdc': { queryable: true, title: 'Vliegdagcontour' }
      }
    },
    {
      id: 3211,
      title: 'Ortho Vl. 2013-2015 Grootschalig',
      touId: 'be-vlaanderen',
      type: 'WMS',
      url: 'https://geo.api.vlaanderen.be/OGW/wms',
      crs: 'EPSG:3857',
      bbox: [2.519999, 50.639999, 5.940002, 51.510003],
      format: 'image/jpeg',
      area: 'BE',
      abstract: 'Tijdsreeks van grootschalige orthofotomozaïeken met een resolutie van 10cm, gebiedsdekkend voor Vlaanderen',
      attribution: 'Agentschap Informatie Vlaanderen',
      pixelManipulations: ['whiteTiles2transparent'],
      getExternalUrl: (extent) => 'http://www.geopunt.be/kaart?app=Geopunt-kaart_app&kaart=Luchtfoto Vlaanderen, winter 2013-2015 - kleur&extent=' + extent.left + ',' + extent.right + ',' + extent.bottom + ',' + extent.top,
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['OGWRGB13_15VL', 'OGWRGB13_15VL_vdc'],
      layers: {
        'OGWRGB13_15VL': { queryable: false, title: 'Orthofotomozaïek, grootschalig, winteropnamen, kleur, 2013-2015, Vlaanderen' },
        'OGWRGB13_15VL_vdc': { queryable: true, title: 'Vliegdagcontour, grootschalig, winteropnamen, kleur, 2013-2015, Vlaanderen' }
      }
    },
    {
      id: 3212,
      title: 'Snelheidsregimes en referentiepunten AWV',
      touId: 'be-vlaanderen',
      type: 'WMS',
      url: 'https://opendata.apps.mow.vlaanderen.be/opendata-geoserver/awv/ows',
      crs: 'EPSG:3857',
      bbox: [2.539465, 50.681421, 5.892607, 51.500095],
      format: 'image/png',
      area: 'BE',
      abstract: 'Snelheidsregimes langs de genummerde wegen in beheer van AWV',
      getExternalUrl: (extent) => 'http://www.geopunt.be/kaart?app=Geopunt-kaart_app&kaart=Snelheidsregimes&extent=' + extent.left + ',' + extent.right + ',' + extent.bottom + ',' + extent.top,
      attribution: 'Agentschap Informatie Vlaanderen',
      pixelManipulations: ['removePartialBlackTransparency', 'traceGrayscalePixels'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['awv:Snelheidsregimes', 'awv:Referentiepunten'],
      layers: {
        'awv:Snelheidsregimes': { queryable: true, title: 'Snelheidsregimes langs de genummerde wegen in beheer van AWV' },
        'awv:Referentiepunten': { queryable: true, title: 'Km en hm referentiepunten' }
      }
    },
    {
      id: 3216,
      title: 'Orthophotos 2016',
      touId: 'be-wallonie',
      type: 'WMS',
      url: 'https://geoservices.wallonie.be/arcgis/services/IMAGERIE/ORTHO_2016/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [2.832011, 49.434306, 6.465498, 50.880207],
      format: 'image/jpeg',
      area: 'BE',
      abstract: 'Service de visualisation INSPIRE permettant la visualisation de l\'image orthorectifiée et mosaïquée couvrant l\'entièreté du territoire wallon à une résolution de 25 cm pour l\'année 2016.',
      attribution: 'Service public de Wallonie',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: false,
      default_layers: ['0'],
      layers: {
        '0': { queryable: false, title: 'ORTHO_2016', abstract: 'Imagerie orthorectifiée et mosaïquée couvrant l\'entièreté du territoire wallon à une résolution de 25 cm.' }
      }
    },
    {
      id: 3217,
      title: 'Réseau routier régional',
      touId: 'be-wallonie',
      type: 'WMS',
      url: 'https://geoservices.wallonie.be/arcgis/services/MOBILITE/RES_ROUTIER_REGIONAL/MapServer/WmsServer',
      crs: 'EPSG:3857',
      bbox: [2.654315, 49.426121, 6.651405, 51.110628],
      format: 'image/png',
      area: 'BE',
      abstract: 'Consultation, recherche et identification des données relatives au Réseau routier régional wallon et aux bornes kilométriques.',
      attribution: 'Service publique de Wallonie',
      pixelManipulations: ['traceGrayscalePixels'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['1', '2', '3', '5', '6'],
      layers: {
        '1': { queryable: true, title: 'Nationales' },
        '2': { queryable: true, title: 'Rings' },
        '3': { queryable: true, title: 'Autoroutes' },
        '5': { queryable: true, title: 'Bornes kilométriques' },
        '6': { queryable: true, title: 'Bornes hectométriques' }
      }
    },
    {
      id: 3220,
      title: 'Verkeersborden Vlaanderen',
      touId: 'be-vlaanderen',
      type: 'WMS',
      url: 'https://opendata.apps.mow.vlaanderen.be/opendata-geoserver/awv/ows',
      crs: 'EPSG:3857',
      bbox: [2.50727, 50.661802, 5.957286, 51.519573],
      format: 'image/png',
      area: 'BE',
      abstract: 'Puntvoorstelling van de verkeersborden uit de toepassing Verkeersborden.Vlaanderen',
      attribution: 'MOW Vlaanderen',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['awv:Verkeersborden.Vlaanderen_Borden'],
      layers: {
        'awv:Verkeersborden.Vlaanderen_Borden': { title: 'Verkeersborden.Vlaanderen', queryable: true }
      }
    },
    {
      id: 3221,
      title: 'Afgeleide snelheidsregimes',
      touId: 'be-vlaanderen',
      type: 'WMS',
      url: 'https://opendata.apps.mow.vlaanderen.be/opendata-geoserver/awv/ows',
      crs: 'EPSG:3857',
      bbox: [2.52988, 50.629179, 5.971281, 51.505513],
      format: 'image/png',
      area: 'BE',
      abstract: 'Kaart van de afgeleide snelheidsregimes op wegen gelegen in het Vlaams gewest.',
      attribution: 'MOW Vlaanderen',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['awv:Afgeleide_snelheidsregimes'],
      layers: {
        'awv:Afgeleide_snelheidsregimes': { title: 'Afgeleide snelheidsregimes', queryable: true }
      }
    },
    {
      id: 3222,
      title: 'Brussels CIRB (FR)',
      touId: 'be-urbis',
      type: 'WMS',
      url: 'https://geoservices-urbis.irisnet.be/geoserver/BaseMaps/ows',
      crs: 'EPSG:31370',
      bbox: [4.236257, 50.760569, 4.487579, 50.915368],
      format: 'image/png',
      area: 'BE',
      abstract: 'Données de carte Bruxelloises',
      attribution: 'Irisnet GIS',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['BaseMaps:UrbISFrenchLabeledColor'],
      layers: {
        'BaseMaps:UrbISFrenchLabeledColor': { queryable: false, title: 'Urbis Base Map FR' },
        'BaseMaps:UrbISFrenchLabeledGray': { queryable: false, title: 'Urbis Base Map Gray FR' },
        'urbisvector:StreetAxes': { queryable: true, title: 'Labeled Street Axe' },
        'urbisvector:StreetAxes_Underground': { queryable: true, title: 'Labeled Street Axe Underground' },
        'inspire:AD.Address': { queryable: true, title: 'Address points (INSPIRE)' },
        'urbisvector:AddressNumbers': { queryable: true, title: 'Address points' },
        'inspire:Bu': { queryable: true, title: 'Buildings (INSPIRE)' },
        'urbisvector:Buildings': { queryable: true, title: 'Buildings' },
        'urbisvector:MonitoringDistricts': { queryable: true, title: 'Monitoring districts' },
        'urbisvector:Municipalities': { queryable: true, title: 'Municipalities' },
        'urbisvector:StreetSurfaces': { queryable: false, title: 'Street surfaces' },
        'urbisvector:StreetSurfaces_Underground': { queryable: false, title: 'Street surfaces Underground' },
        'urbisvector:Region': { queryable: false, title: 'Region' },
        'urbisvector:StatisticalSectors': { queryable: true, title: 'Statistical sectors' },
        'urbisvector:StreetNodes': { queryable: false, title: 'Street nodes' },
        'urbisvector:TrainNetwork': { queryable: false, title: 'Rail tracks' },
        'urbisvector:TrainNetwork_Underground': { queryable: false, title: 'Rail tracks Underground' },
        'inspire:GN.GeographicalNames': { queryable: true, title: 'Geographical Names' },
        'urbisvector:PointsOfInterest': { queryable: true, title: 'Points of interest' },
        'urbistopo:TopoLines': { queryable: false, title: 'Urbis Topo Lines' },
        'urbistopo:TopoPoints': { queryable: true, title: 'Urbis Topo Points' }
      }
    },
    {
      id: 3223,
      title: 'Brussels Ortho',
      touId: 'be-urbis',
      type: 'WMS',
      url: 'https://geoservices-urbis.irisnet.be/geoserver/urbisgrid/ows',
      crs: 'EPSG:31370',
      bbox: [4.236257, 50.760569, 4.487579, 50.915368],
      format: 'image/png',
      area: 'BE',
      abstract: 'Orthographic map of Brussels',
      attribution: 'Irisnet GIS',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: false,
      default_layers: ['Ortho'],
      layers: {
        'Ortho': { queryable: false, title: 'Latest Ortho' },
        'Ortho2024Eo': { queryable: false, title: 'Ortho 2024 East-West' },
        'Ortho2024NirEo': { queryable: false, title: 'Ortho 2024 Near Infrared' },
        'Ortho2024NirNs': { queryable: false, title: 'Ortho 2024 Near Infrared North-South' },
        'Ortho2024Ns': { queryable: false, title: 'Ortho 2024 North-South' },
        'Ortho2023Nir': { queryable: false, title: 'Ortho 2023 Near Infrared' },
        'Ortho2023': { queryable: false, title: 'Ortho 2023' },
        'Ortho2022Ns': { queryable: false, title: 'Ortho 2022 North-South' },
        'Ortho2022Eo': { queryable: false, title: 'Ortho 2022 East-West' },
        'Ortho2021Ns': { queryable: false, title: 'Ortho 2021 North-South' },
        'Ortho2021Eo': { queryable: false, title: 'Ortho 2021 East-West' },
        'Ortho2020': { queryable: false, title: 'Ortho 2020' },
        'Ortho2019': { queryable: false, title: 'Ortho 2019' },
        'Ortho2018': { queryable: false, title: 'Ortho 2018' },
        'Ortho2017': { queryable: false, title: 'Ortho 2017' },
        'Ortho2016': { queryable: false, title: 'Ortho 2016' },
        'Ortho2015': { queryable: false, title: 'Ortho 2015' },
        'Ortho2014': { queryable: false, title: 'Ortho 2014' },
        'Ortho2012': { queryable: false, title: 'Ortho 2012' },
        'Ortho2009': { queryable: false, title: 'Ortho 2009' },
        'Ortho2004': { queryable: false, title: 'Ortho 2004' }
      }
    },
    {
      id: 3224,
      title: 'Brussels Road Hierarchy',
      touId: 'be-mobility',
      type: 'WMS',
      url: 'https://data.mobility.brussels/geoserver/bm_network/wms',
      crs: 'EPSG:3857',
      bbox: [4.236257, 50.760569, 4.487579, 50.915368],
      format: 'image/png',
      area: 'BE',
      abstract: 'Road hierarchy maintained by Brussels Mobility',
      attribution: 'Brussels Mobility',
      pixelManipulations: ['brusselsSwapColours'],
      queryable: false,
      default_layers: ['specialisation_vp'],
      layers: {
        'specialisation_vp': { queryable: false, title: 'Road hierarchy' }
      }
    },
    {
      id: 3225,
      title: 'Brussels Zone 30',
      touId: 'be-mobility',
      type: 'WMS',
      url: 'https://data.mobility.brussels/geoserver/bm_network/wms',
      crs: 'EPSG:3857',
      bbox: [4.236257, 50.760569, 4.487579, 50.915368],
      format: 'image/png',
      area: 'BE',
      abstract: 'Road speed limit data maintained by Brussels Mobility',
      attribution: 'Brussels Mobility',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['Zones_30_polygon'],
      layers: {
        'Zones_30_polygon': { queryable: true, title: 'Zone 30' }
      }
    },
    {
      id: 3226,
      title: 'Brussels Low Emission Zone',
      touId: 'be-mobility',
      type: 'WMS',
      url: 'https://data.mobility.brussels/geoserver/bm_network/wms',
      crs: 'EPSG:3857',
      bbox: [4.236257, 50.760569, 4.487579, 50.915368],
      format: 'image/png',
      area: 'BE',
      abstract: 'Defines the contours of the low emission zone active in Brussels',
      attribution: 'Brussels Mobility',
      queryable: false,
      default_layers: ['lez_zone'],
      layers: {
        'lez_zone': { queryable: false, title: 'Low Emission Zone' }
      }
    },
    {
      id: 3227,
      title: 'Verkeersborden Vlaanderen Visualisatie',
      touId: 'be-vlaanderen',
      type: 'WMS',
      url: 'https://opendata.apps.mow.vlaanderen.be/opendata-geowebcache/service/wms',
      crs: 'EPSG:3857',
      bbox: [2.50727, 50.661802, 5.957286, 51.519573],
      format: 'image/png',
      area: 'BE',
      abstract: 'Grafische voorstelling van de verkeersborden uit de toepassing Verkeersborden.Vlaanderen',
      attribution: 'MOW Vlaanderen',
      pixelManipulations: ['addTranslucentOverlay'],
      queryable: false,
      default_layers: ['verkeersborden'],
      layers: {
        'verkeersborden': { title: 'Grafische voorstelling verkeersborden', queryable: false }
      }
    },
    {
      id: 3228,
      title: 'Orthophotos Récentes',
      touId: 'be-wallonie',
      type: 'WMS',
      url: 'https://geoservices.wallonie.be/arcgis/services/IMAGERIE/ORTHO_LAST/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [2.832011, 49.434306, 6.465498, 50.880207],
      format: 'image/jpeg',
      area: 'BE',
      abstract: 'Service de visualisation WMS référençant la dernière campagne disponible des images orthorectifiées couvrant le territoire de la Région Wallonne.',
      attribution: 'Service public de Wallonie',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: false,
      default_layers: ['0'],
      layers: {
        '0': { queryable: false, title: 'ORTHO', abstract: 'Dernière campagne disponible d\'imagerie orthorectifiée et mosaïquée couvrant l\'entièreté du territoire wallon à une résolution de 25 cm.' }
      }
    },
    {
      id: 3229,
      title: 'Orthophotos 2017',
      touId: 'be-wallonie',
      type: 'WMS',
      url: 'https://geoservices.wallonie.be/arcgis/services/IMAGERIE/ORTHO_2017/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [2.832011, 49.434306, 6.465498, 50.880207],
      format: 'image/jpeg',
      area: 'BE',
      abstract: 'Service de visualisation INSPIRE permettant la visualisation de l\'image orthorectifiée et mosaïquée couvrant l\'entièreté du territoire wallon à une résolution de 25 cm pour l\'année 2017.',
      attribution: 'Service public de Wallonie',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: false,
      default_layers: ['0'],
      layers: {
        '0': { queryable: false, title: 'ORTHO_2017', abstract: 'Imagerie orthorectifiée et mosaïquée couvrant l\'entièreté du territoire wallon à une résolution de 25 cm.' }
      }
    },
    {
      id: 3230,
      title: 'Orthophotos 2018',
      touId: 'be-wallonie',
      type: 'WMS',
      url: 'https://geoservices.wallonie.be/arcgis/services/IMAGERIE/ORTHO_2018/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [2.832011, 49.434306, 6.465498, 50.880207],
      format: 'image/jpeg',
      area: 'BE',
      abstract: 'Service de visualisation INSPIRE permettant la visualisation de l\'image orthorectifiée et mosaïquée couvrant l\'entièreté du territoire wallon à une résolution de 25 cm pour l\'année 2018.',
      attribution: 'Service public de Wallonie',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: false,
      default_layers: ['0'],
      layers: {
        '0': { queryable: false, title: 'ORTHO_2018', abstract: 'Imagerie orthorectifiée et mosaïquée couvrant l\'entièreté du territoire wallon à une résolution de 25 cm.' }
      }
    },
    {
      id: 3231,
      title: 'Orthophotos 2019',
      touId: 'be-wallonie',
      type: 'WMS',
      url: 'https://geoservices.wallonie.be/arcgis/services/IMAGERIE/ORTHO_2019/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [2.832011, 49.434306, 6.465498, 50.880207],
      format: 'image/jpeg',
      area: 'BE',
      abstract: 'Service de visualisation INSPIRE permettant la visualisation de l\'image orthorectifiée et mosaïquée couvrant l\'entièreté du territoire wallon à une résolution de 25 cm pour l\'année 2019.',
      attribution: 'Service public de Wallonie',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: false,
      default_layers: ['0'],
      layers: {
        '0': { queryable: false, title: 'ORTHO_2019', abstract: 'Imagerie orthorectifiée et mosaïquée couvrant l\'entièreté du territoire wallon à une résolution de 25 cm.' }
      }
    },
    {
      id: 3232,
      title: 'Ville 30/Stad 30',
      touId: 'be-mobility',
      type: 'WMS',
      url: 'https://data.mobility.brussels/geoserver/bm_network/wms',
      crs: 'EPSG:3857',
      bbox: [4.236257, 50.760569, 4.487579, 50.915368],
      zoomRange: [15, 22],
      format: 'image/png',
      area: 'BE',
      abstract: 'Future speed limits in Brussels Mobility (green/blue: 30, orange: 50, pink: 70, black: 90/120)',
      attribution: 'Brussels Mobility',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['ville30_detailed'],
      layers: {
        'ville30_detailed': { queryable: true, title: 'Road speeds' }
      }
    },
    {
      id: 3234,
      title: 'Cadastral Borders',
      touId: 'be-minfin',
      type: 'WMS',
      url: 'https://ccff02.minfin.fgov.be/geoservices/arcgis/services/WMS/Cadastral_Layers/MapServer/WmsServer',
      crs: 'EPSG:3857',
      bbox: [2.541334, 49.496885, 6.408098, 51.505116],
      format: 'image/png',
      area: 'BE',
      abstract: 'Map of cadastral borders as they are defined at FPS Finances. This can often be used to find town borders.',
      attribution: 'FPS Finances - General Administration of Patrimonial Documentation',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: [ 'Regional_building', 'Cadastral_building', 'Cadastral_parcel', 'Polder_wateringue_zone', 'Address', 'Property_stone', 'Cadastral_block', 'Cadastral_section', 'Cadastral_division', 'Municipality', 'District', 'Province', 'Region', 'Country' ],
      layers: {
        'Regional_building': { queryable: true, title: 'Regional building' },
        'Cadastral_building': { queryable: true, title: 'Cadastral building' },
        'Cadastral_parcel': { queryable: true, title: 'Cadastral parcel' },
        'Polder_wateringue_zone': { queryable: true, title: 'Polder wateringue zone' },
        'Address': { queryable: true, title: 'Address' },
        'Property_stone': { queryable: true, title: 'Property stone' },
        'Cadastral_block': { queryable: true, title: 'Cadastral block' },
        'Cadastral_section': { queryable: true, title: 'Cadastral section' },
        'Cadastral_division': { queryable: true, title: 'Cadastral division' },
        'Municipality': { queryable: true, title: 'Municipality' },
        'District': { queryable: true, title: 'District' },
        'Province': { queryable: true, title: 'Province' },
        'Region': { queryable: true, title: 'Region' },
        'Country': { queryable: true, title: 'Country' }
      }
    },
    {
      id: 3235,
      title: 'Agentschap Innoveren en Ondernemen',
      touId: 'be-vlaanderen',
      type: 'WMS',
      url: 'https://geo.api.vlaanderen.be/VLAIO/wms',
      crs: 'EPSG:3857',
      bbox: [2.50727, 50.661802, 5.957286, 51.519573],
      format: 'image/png',
      area: 'BE',
      abstract: 'Bevat de locaties van brownfieldconvenanten, steunzones en bedrijventerreinen',
      attribution: 'Agentschap Digitaal Vlaanderen',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: [ 'Brownf', 'Steunzone', 'Bedrplan', 'Bedrter', 'Bedrontw', 'Bedrperc', 'Bedrpercab', 'Bedrbeh' ],
      layers: {
        'Brownf': { queryable: true, title: 'Brownfieldconvenanten' },
        'Steunzone': { queryable: true, title: 'Steunzones - Gebieden waar inhouding van bedrijfsvoorheffing mogelijk is' },
        'Bedrplan': { queryable: true, title: 'Planningszone met economische bestemming' },
        'Bedrter': { queryable: true, title: 'Bedrijventerrein' },
        'Bedrontw': { queryable: true, title: 'Ontwikkelbare bedrijvenzone' },
        'Bedrperc': { queryable: true, title: 'Bedrijventerreinperceel' },
        'Bedrpercab': { queryable: true, title: 'Bedrijventerreinperceelaanbieding' },
        'Bedrbeh': { queryable: true, title: 'Beheerde bedrijvenzone' }
      }
    },
    {
      id: 3236,
      title: 'Publieke oplaadpunten',
      touId: 'be-vlaanderen',
      url: 'https://geoserver.gis.cloud.mow.vlaanderen.be/geoserver/ows',
      crs: 'EPSG:3857',
      bbox: [2.50727, 50.661802, 5.957286, 51.519573],
      format: 'image/png',
      area: 'BE',
      abstract: 'Laadpunten voor elektrische voertuigen in Vlaanderen',
      attribution: 'MOW Vlaanderen',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['laadpunten_public'],
      layers: {
        'laadpunten_public': { queryable: true, title: 'Publieke laadpunten' }
      }
    },
    {
      id: 3237,
      title: 'Adressenregister Vlaanderen',
      touId: 'be-vlaanderen',
      url: 'https://geo.api.vlaanderen.be/Adressenregister/wms',
      crs: 'EPSG:3857',
      bbox: [2.52, 50.64, 5.94, 51.51],
      format: 'image/png',
      area: 'BE',
      abstract: 'In het adressenregister zijn alle adressen in Vlaanderen opgeslagen samen met één of meer puntgeometrieën.',
      attribution: 'Agentschap Informatie Vlaanderen',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['A_VOORGESTELD', 'A_INGEBRUIK'],
      layers: {
        'A_VOORGESTELD': { queryable: true, title: 'Voorgestelde adressen' },
        'A_INGEBRUIK': { queryable: true, title: 'Adressen in gebruik' },
        'A_GEHISTOREERD': { queryable: true, title: 'Gehistoreerde adressen' },
        'A_AFGEKEURD': { queryable: true, title: 'Afgekeurde adressen' }
      }
    },
    {
      id: 3238,
      title: 'GIPOD Actueel',
      touId: 'be-vlaanderen',
      type: 'WMS',
      url: 'https://geo.api.vlaanderen.be/GIPOD/wms',
      crs: 'EPSG:3857',
      bbox: [2.52, 50.64, 5.94, 51.51],
      format: 'image/png',
      area: 'BE',
      abstract: 'Overzicht van mobiliteitshinder vandaag. Meer kaartlagen (grondwerken, werken, evenementen) zijn beschikbaar in de instellingen',
      attribution: 'Agentschap Informatie Vlaanderen',
      getExternalUrl: (extent) => 'http://www.geopunt.be/kaart?app=Hinder_in_kaart_app&extent=' + extent.left + ',' + extent.right + ',' + extent.bottom + ',' + extent.top,
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['GIPOD_MOBHINDER_VNDG', 'GIPOD_MOBHINDER_VNDG_ICOON'],
      layers: {
        'GIPOD_MOBHINDER_VNDG': { queryable: true, title: 'Mobiliteitshinder vandaag' },
        'GIPOD_MOBHINDER_VNDG_ICOON': { queryable: true, title: 'Mobiliteitshinder vandaag (icoon)' },
        'GIPOD_GRONDWERK_VNDG': { queryable: true, title: 'Grondwerken vandaag' },
        'GIPOD_GRONDWERK_VNDG_ICOON': { queryable: true, title: 'Grondwerken vandaag (icoon)' },
        'GIPOD_WERK_VNDG': { queryable: true, title: 'Werken vandaag' },
        'GIPOD_WERK_VNDG_ICOON': { queryable: true, title: 'Werken vandaag (icoon)' },
        'GIPOD_EVENEMENT_VNDG': { queryable: true, title: 'Evenementen vandaag' },
        'GIPOD_EVENEMENT_VNDG_ICOON': { queryable: true, title: 'Evenementen vandaag (icoon)' }
      }
    },
    {
      id: 3239,
      title: 'GIPOD Komende Maand',
      touId: 'be-vlaanderen',
      type: 'WMS',
      url: 'https://geo.api.vlaanderen.be/GIPOD/wms',
      crs: 'EPSG:3857',
      bbox: [2.52, 50.64, 5.94, 51.51],
      format: 'image/png',
      area: 'BE',
      abstract: 'Overzicht van mobiliteitshinder komende maand. Meer kaartlagen (grondwerken, werken, evenementen) zijn beschikbaar in de instellingen',
      attribution: 'Agentschap Informatie Vlaanderen',
      getExternalUrl: (extent) => 'http://www.geopunt.be/kaart?app=Hinder_in_kaart_app&extent=' + extent.left + ',' + extent.right + ',' + extent.bottom + ',' + extent.top,
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['GIPOD_MOBHINDER_MAAND', 'GIPOD_MOBHINDER_MAAND_ICOON'],
      layers: {
        'GIPOD_MOBHINDER_MAAND': { queryable: true, title: 'Mobiliteitshinder komende maand' },
        'GIPOD_MOBHINDER_MAAND_ICOON': { queryable: true, title: 'Mobiliteitshinder komende maand (icoon)' },
        'GIPOD_GRONDWERK_MAAND': { queryable: true, title: 'Grondwerken komende maand' },
        'GIPOD_GRONDWERK_MAAND_ICOON': { queryable: true, title: 'Grondwerken komende maand (icoon)' },
        'GIPOD_WERK_MAAND': { queryable: true, title: 'Werken komende maand' },
        'GIPOD_WERK_MAAND_ICOON': { queryable: true, title: 'Werken komende maand (icoon)' },
        'GIPOD_EVENEMENT_MAAND': { queryable: true, title: 'Evenementen komende maand' },
        'GIPOD_EVENEMENT_MAAND_ICOON': { queryable: true, title: 'Evenementen komende maand (icoon)' }
      }
    },
    {
      id: 3240,
      title: 'Orthophotos 2024',
      touId: 'be-wallonie',
      type: 'WMS',
      url: 'https://geoservices.wallonie.be/arcgis/services/IMAGERIE/ORTHO_2024/MapServer/WMSServer',
      crs: 'EPSG:3857',
      bbox: [2.832011, 49.434306, 6.465498, 50.880207],
      format: 'image/jpeg',
      area: 'BE',
      abstract: 'Service de visualisation INSPIRE permettant la visualisation de l\'image orthorectifiée et mosaïquée couvrant l\'entièreté du territoire wallon à une résolution de 25 cm pour l\'année 2019.',
      attribution: 'Service public de Wallonie',
      pixelManipulations: ['whiteTiles2transparent'],
      queryable: false,
      default_layers: ['0'],
      layers: {
        '0': { queryable: false, title: 'ORTHO_2024', abstract: 'Imagerie orthorectifiée et mosaïquée couvrant l\'entièreté du territoire wallon à une résolution de 25 cm.' }
      }
    },
    {
      id: 5501,
      title: 'Mapa basico Rio de Janeiro',
      touId: 'none',
      type: 'WMS',
      url: 'http://pgeo3.rio.rj.gov.br/arcgis/services/Basicos/mapa_basico_UTM/MapServer/WmsServer',
      crs: 'EPSG:3857',
      bbox: [-43.846517, -23.122354, -43.064318, -22.729244],
      format: 'image/png',
      area: 'BR',
      abstract: 'Mapa urbano básico da Cidade do Rio de Janeiro',
      attribution: 'Cidade do Rio de Janeiro',
      pixelManipulations: ['rioTransparent'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25'],
      layers: {
        '0': { queryable: false, title: 'Limite do Estado do Rio de Janeiro' },
        '1': { queryable: false, title: 'relevo' },
        '2': { queryable: false, title: 'Quadras' },
        '3': { queryable: true, title: 'Logradouros - Ruas' },
        '4': { queryable: false, title: 'Praças' },
        '5': { queryable: false, title: 'Areas Protegidas' },
        '6': { queryable: true, title: 'Favelas' },
        '7': { queryable: false, title: 'Loteamentos Irregulares e Clandestinos' },
        '8': { queryable: false, title: 'edificações' },
        '9': { queryable: false, title: 'Hidrografia - Rios' },
        '10': { queryable: false, title: 'Limite de Bairros' },
        '11': { queryable: false, title: 'Limite de Regiões Administrativas - RA' },
        '12': { queryable: false, title: 'Áreas de Planejamento - AP' },
        '13': { queryable: false, title: 'número de porta' },
        '14': { queryable: true, title: 'principais logradouros' },
        '15': { queryable: false, title: 'Locais de Referência' },
        '16': { queryable: false, title: 'Escolas Municipais' },
        '17': { queryable: false, title: 'Unidades de Saúde Estaduais e Federais' },
        '18': { queryable: false, title: 'Unidades de Saúde Municipais' },
        '19': { queryable: false, title: 'Corpo de Bombeiros' },
        '20': { queryable: false, title: 'Delegacias Policiais' },
        '21': { queryable: false, title: 'Estações de Bonde' },
        '22': { queryable: false, title: 'Estações Hidroviárias' },
        '23': { queryable: false, title: 'Estações Ferroviárias' },
        '24': { queryable: false, title: 'Estações do Metrô' },
        '25': { queryable: false, title: 'Aeroportos' }
      }
    },
    {
      id: 35201,
      title: 'Orthophotos Luxembourg',
      touId: 'none',
      type: 'WMS',
      url: 'https://wmts1.geoportail.lu/opendata/service',
      crs: 'EPSG:3857',
      bbox: [5.71, 49.43, 6.55, 50.19],
      format: 'image/jpeg',
      area: 'LU',
      abstract: 'Orthophotos de Luxembourg par l\'Administration du cadastre et de la topographie du Grand-Duché du Luxembourg',
      attribution: 'Cadastre et topographie Grand-Duché du Luxembourg',
      queryable: false,
      default_layers: ['ortho_latest'],
      layers: {
        'ortho_latest': { queryable: false, title: 'Dernières Photographies aériennes orthorectifiées' },
        'ortho_2025_winter': { queryable: false, title: 'Photographies aériennes orthorectifiesé 2025 hiver' },
        'ortho_2023': { queryable: false, title: 'Photographies aériennes orthorectifiées 2023' },
        'ortho_2022': { queryable: false, title: 'Photographies aériennes orthorectifiées 2022' },
        'ortho_2021': { queryable: false, title: 'Photographies aériennes orthorectifiées 2021' },
        'ortho_2020': { queryable: false, title: 'Photographies aériennes orthorectifiées 2020' },
        'ortho_2019_winter': { queryable: false, title: 'Photographies aériennes orthorectifiées 2019 hiver' },
        'ortho_2019_luref': { queryable: false, title: 'Photographies aériennes orthorectifiées 2019 en LUREF' },
        'ortho_2019': { queryable: false, title: 'Photographies aériennes orthorectifiées 2019' },
        'ortho_2018': { queryable: false, title: 'Photographies aériennes orthorectifiées 2018' },
        'ortho_2017': { queryable: false, title: 'Photographies aériennes orthorectifiées 2017' },
        'ortho_2016': { queryable: false, title: 'Photographies aériennes orthorectifiées 2016' },
        'ortho_2013': { queryable: false, title: 'Photographies aériennes orthorectifiées 2013' },
        'ortho_irc': { queryable: false, title: 'Photographies aériennes orthorectifiées infrarouges 2010' },
        'ortho_2010': { queryable: false, title: 'Photographies aériennes orthorectifiées 2010' },
        'ortho_2007': { queryable: false, title: 'Photographies aériennes orthorectifiées 2007' },
        'ortho_2004': { queryable: false, title: 'Photographies aériennes orthorectifiées 2004' },
        'ortho_2001': { queryable: false, title: 'Photographies aériennes orthorectifiées 2001' },
        'ortho_1967': { queryable: false, title: 'Photographies aériennes orthorectifiées 1967' }
      }
    },
    {
      id: 35202,
      title: 'BD-Adresses Luxembourg',
      touId: 'none',
      type: 'WMS',
      url: 'https://wmts1.geoportail.lu/opendata/service',
      crs: 'EPSG:3857',
      bbox: [5.71, 49.43, 6.55, 50.19],
      format: 'image/png',
      area: 'LU',
      abstract: 'La BD-Adresses est un sous-ensemble des adresses figurant dans le registre national des localités et des rues.',
      attribution: 'Cadastre et topographie Grand-Duché du Luxembourg',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['addresses'],
      layers: {
        'addresses': { queryable: true, title: 'Points adresse' }
      }
    },
    {
      id: 35203,
      title: 'Cadastre Luxembourg',
      touId: 'none',
      type: 'WMS',
      url: 'https://wmts1.geoportail.lu/opendata/service',
      crs: 'EPSG:3857',
      bbox: [5.71, 49.43, 6.55, 50.19],
      format: 'image/png',
      area: 'LU',
      abstract: 'The BD-L-GeoBase is the official reference for geographic vector data produced by the Administration du Cadastre et de la Topographie.',
      attribution: 'Cadastre et topographie Grand-Duché du Luxembourg',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['parcels', 'parcels_labels', 'buildings', 'toponymes', 'cadastre'],
      layers: {
        'parcels': { queryable: true, title: 'Parcelles cadastrales' },
        'parcels_labels': { queryable: false, title: 'Numéros parcellaires' },
        'buildings': { queryable: false, title: 'Bâtiments du plan cadastral' },
        'toponymes': { queryable: false, title: 'Toponymes cadastraux' },
        'cadastre': { queryable: false, title: 'Plan cadastral complet' },
      }
    },
    {
      id: 35204,
      title: 'Réseau Routier Luxembourg',
      touId: 'none',
      type: 'WMS',
      url: 'https://wmts1.geoportail.lu/opendata/service',
      crs: 'EPSG:3857',
      bbox: [5.71, 49.43, 6.55, 50.19],
      format: 'image/png',
      area: 'LU',
      abstract: 'Le réseau routier et les noms de rue.',
      attribution: 'Cadastre et topographie Grand-Duché du Luxembourg',
      queryable: false,
      default_layers: ['reseau_routier', 'road_names'],
      layers: {
        'reseau_routier': { queryable: false, title: 'Réseau routier' },
        'road_names': { queryable: false, title: 'Noms de rue' },
      }
    },
    {
      id: 38501,
      title: 'Digitalni ortofoto 2022',
      touId: 'none',
      type: 'WMS',
      url: 'https://geoportal.dgu.hr/services/inspire/orthophoto_2022/ows',
      crs: 'EPSG:3765',
      bbox: [13.2858, 42.3982, 19.6392, 46.5321],
      format: 'image/png',
      area: 'HR',
      abstract: 'Digitalni ortofoto 2022. - WMS servis za anonimne korisnike (WMS)',
      attribution: 'Državna geodetska uprava Republike Hrvatske',
      queryable: false,
      default_layers: ['OI.OrthoimageCoverage'],
      layers: {
        'OI.OrthoimageCoverage': { queryable: false, title: 'Digitalni ortofoto 2022.' }
      }
    },
    {
      id: 38502,
      title: 'Digitalni ortofoto 2021',
      touId: 'none',
      type: 'WMS',
      url: 'https://geoportal.dgu.hr/services/inspire/orthophoto_2021/ows',
      crs: 'EPSG:3765',
      bbox: [15.3653, 42.3333, 19.5108, 46.5615],
      format: 'image/png',
      area: 'HR',
      abstract: 'Digitalni ortofoto 2021. - WMS servis za anonimne korisnike (WMS)',
      attribution: 'Državna geodetska uprava Republike Hrvatske',
      queryable: false,
      default_layers: ['OI.OrthoimageCoverage'],
      layers: {
        'OI.OrthoimageCoverage': { queryable: false, title: 'Digitalni ortofoto 2021.' }
      }
    },
    {
      id: 38503,
      title: 'Digitalni ortofoto 2020',
      touId: 'none',
      type: 'WMS',
      url: 'https://geoportal.dgu.hr/services/inspire/orthophoto_2020/ows',
      crs: 'EPSG:3765',
      bbox: [15.3653, 42.3333, 19.5108, 46.5615],
      format: 'image/png',
      area: 'HR',
      abstract: 'Digitalni ortofoto 2020. - WMS servis za anonimne korisnike (WMS)',
      attribution: 'Državna geodetska uprava Republike Hrvatske',
      queryable: false,
      default_layers: ['OI.OrthoimageCoverage'],
      layers: {
        'OI.OrthoimageCoverage': { queryable: false, title: 'Digitalni ortofoto 2020.' }
      }
    },
    {
      id: 38504,
      title: 'Digitalni ortofoto 2019',
      touId: 'none',
      type: 'WMS',
      url: 'https://geoportal.dgu.hr/services/inspire/orthophoto_2021/ows',
      crs: 'EPSG:3765',
      bbox: [15.3653, 42.3333, 19.5108, 46.5615],
      format: 'image/png',
      area: 'HR',
      abstract: 'Digitalni ortofoto 2019. - WMS servis za anonimne korisnike (WMS)',
      attribution: 'Državna geodetska uprava Republike Hrvatske',
      queryable: false,
      default_layers: ['OI.OrthoimageCoverage'],
      layers: {
        'OI.OrthoimageCoverage': { queryable: false, title: 'Digitalni ortofoto 2019.' }
      }
    },
    {
      id: 38505,
      title: 'Digitalni ortofoto u mjerilu 1:1000 potres Zagreb',
      touId: 'none',
      type: 'WMS',
      url: 'https://geoportal.dgu.hr/services/inspire/orthophoto_1000/wms',
      crs: 'EPSG:3765',
      bbox: [15.8022, 45.6633, 16.2458, 46.0467],
      format: 'image/png',
      area: 'HR',
      abstract: 'Digitalna ortofotokarata u mjerilu 1:1000 (DOF1) za područje dijelova grada Zagreba.',
      attribution: 'Državna geodetska uprava Republike Hrvatske',
      queryable: false,
      default_layers: ['OI.OrthoimageCoverage'],
      layers: {
        'OI.OrthoimageCoverage': { queryable: false, title: 'Digitalni ortofoto u mjerilu 1:1000_potres Zagreb' }
      }
    },
    {
      id: 38506,
      title: 'Prometne mreže',
      touId: 'none',
      type: 'WMS',
      url: 'https://geoportal.dgu.hr/services/inspire/tn/wms',
      crs: 'EPSG:3765',
      bbox: [13.7698, 43.0139, 19.2187, 46.5116],
      format: 'image/png',
      area: 'HR',
      abstract: 'Mrežna usluga pregleda (WMS) za INSPIRE temu Prometne mreže.',
      attribution: 'Državna geodetska uprava Republike Hrvatske',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['TN.RoadTransportNetwork.RoadLink', 'TN.RoadTransportNetwork.RoadArea', 'TN.RoadTransportNetwork.RoadServiceArea'],
      layers: {
        'TN.AirTransportNetwork.RunwayArea': { queryable: true, title: 'Runway Area' },
        'TN.CableTransportNetwork.CablewayLink': { queryable: true, title: 'Cableway Link' },
        'TN.CommonTransportElements.TransportNode': { queryable: true, title: 'Transport Node' },
        'TN.RailTransportNetwork.RailwayArea': { queryable: true, title: 'Railway Area' },
        'TN.RailTransportNetwork.RailwayLink': { queryable: true, title: 'Railway Link' },
        'TN.RailTransportNetwork.RailwayStationArea': { queryable: true, title: 'Railway Station Area' },
        'TN.RoadTransportNetwork.RoadLink': { queryable: true, title: 'Road Link' },
        'TN.RoadTransportNetwork.RoadArea': { queryable: true, title: 'Road Area' },
        'TN.RoadTransportNetwork.RoadServiceArea': { queryable: true, title: 'Road Service Area' },
        'TN.WaterTransportNetwork.PortArea': { queryable: true, title: 'Port Area' },
        'TN.WaterTransportNetwork.WaterwayLink': { queryable: true, title: 'Waterway Link' }
      }
    },
    {
      id: 38507,
      title: 'Zgrade',
      touId: 'none',
      type: 'WMS',
      url: 'https://geoportal.dgu.hr/services/inspire/bu/wms',
      crs: 'EPSG:3765',
      bbox: [13.2858, 42.3982, 19.6392, 46.5321],
      format: 'image/png',
      area: 'HR',
      abstract: 'Mrežna usluga pregleda (WMS) za INSPIRE temu Zgrade.',
      attribution: 'Državna geodetska uprava Republike Hrvatske',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['BU.Building'],
      layers: {
        'BU.Building': { queryable: true, title: 'Building' }
      }
    },
    {
      id: 38508,
      title: 'Adrese',
      touId: 'none',
      type: 'WMS',
      url: 'https://geoportal.dgu.hr/services/inspire/ad/ows',
      crs: 'EPSG:3765',
      bbox: [13.2858, 42.3982, 19.6392, 46.5321],
      format: 'image/png',
      area: 'HR',
      abstract: 'Usluga pregleda za INSPIRE temu Adrese (AD).',
      attribution: 'Državna geodetska uprava Republike Hrvatske',
      query_filters: [ applyAllTransformations ],
      queryable: false,
      default_layers: ['AD.Address'],
      layers: {
        'AD.Address': { queryable: false, title: 'Addresses' }
      }
    },
    // Czech Republic ČÚZK WMS entries: derived from userscript "Czech WMS layers" (@author petrjanik, d2-mac, MajkiiTelini).
    {
      id: 42001,
      title: 'ČÚZK Ortofoto',
      touId: 'cz-cuzk',
      favicon: true,
      type: 'WMS',
      url: 'https://ags.cuzk.gov.cz/arcgis1/services/ORTOFOTO_WM/MapServer/WMSServer?',
      crs: 'EPSG:3857',
      bbox: [12.0, 48.5, 18.9, 51.1],
      format: 'image/png',
      transparent: true,
      area: 'CZ',
      abstract: 'ČÚZK orthophoto (ORTOFOTO_WM, Web Mercator).',
      attribution: 'ČÚZK',
      queryable: false,
      default_layers: ['0'],
      layers: {
        0: { queryable: false, title: 'Orthophoto' }
      }
    },
    {
      id: 42002,
      title: 'ČÚZK Katastrální mapa',
      touId: 'cz-cuzk',
      favicon: true,
      type: 'WMS',
      url: 'https://services.cuzk.cz/wms/wms.asp?',
      crs: 'EPSG:3857',
      bbox: [12.0, 48.5, 18.9, 51.1],
      zoomRange: [15, 22],
      wmsMinEffectiveZoom: 17,
      format: 'image/png',
      transparent: true,
      area: 'CZ',
      abstract: 'ČÚZK cadastral map WMS.',
      attribution: 'ČÚZK',
      queryable: false,
      default_layers: ['hranice_parcel', 'dalsi_p_mapy', 'RST_KN'],
      layers: {
        hranice_parcel: { queryable: false, title: 'Parcel boundaries' },
        dalsi_p_mapy: { queryable: false, title: 'Other cadastral map layers' },
        RST_KN: { queryable: false, title: 'Raster cadastral map (RST_KN)' }
      }
    },
    {
      id: 42003,
      title: 'ČÚZK INSPIRE adresy',
      touId: 'cz-cuzk',
      favicon: true,
      type: 'WMS',
      url: 'https://services.cuzk.cz/wms/inspire-ad-wms.asp?',
      crs: 'EPSG:3857',
      bbox: [12.0, 48.5, 18.9, 51.1],
      format: 'image/png',
      transparent: true,
      area: 'CZ',
      abstract: 'INSPIRE Address (AD) visualization — descriptive and orientation numbers and street names.',
      attribution: 'ČÚZK',
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: [
        'AD.Addresses.Text.AddressNumber',
        'AD.Addresses.ByPrefixNumber.TypOfBuilding.2',
        'AD.Addresses.ByPrefixNumber.TypOfBuilding.1',
        'AD.Addresses.Text.AddressAreaName',
        'AD.Addresses.Text.ThoroughfareName'
      ],
      layers: {
        'AD.Addresses.Text.AddressNumber': { queryable: true, title: 'Address number (text)' },
        'AD.Addresses.ByPrefixNumber.TypOfBuilding.2': { queryable: true, title: 'Building type (č.p.) — variant 2' },
        'AD.Addresses.ByPrefixNumber.TypOfBuilding.1': { queryable: true, title: 'Building type (č.p.) — variant 1' },
        'AD.Addresses.Text.AddressAreaName': { queryable: true, title: 'Address area name' },
        'AD.Addresses.Text.ThoroughfareName': { queryable: true, title: 'Thoroughfare / street name' }
      }
    },
    {
      id: 42004,
      title: 'ČÚZK ZABAGED — Veřejné budovy',
      touId: 'cz-cuzk',
      favicon: true,
      type: 'WMS',
      url: 'https://ags.cuzk.gov.cz/arcgis/services/ZABAGED_POLOHOPIS/MapServer/WMSServer?',
      crs: 'EPSG:3857',
      bbox: [12.0, 48.5, 18.9, 51.1],
      format: 'image/png',
      transparent: true,
      area: 'CZ',
      abstract: 'ZABAGED® polohopis — public buildings and institutions (layer ids remapped for ZABAGED_POLOHOPIS; two stacks).',
      attribution: 'ČÚZK ZABAGED®',
      queryable: false,
      default_layers: ['94,95,96,97,98,99,100,101,102,103', '38,39,40,41,42,43,44,123'],
      layers: {
        '94,95,96,97,98,99,100,101,102,103': { queryable: false, title: 'Public facility points (hospital, school, office, …)' },
        '38,39,40,41,42,43,44,123': { queryable: false, title: 'Building footprints & major structures' }
      }
    },
    {
      id: 42005,
      title: 'ČÚZK ZABAGED — Lesy a vodstva',
      touId: 'cz-cuzk',
      favicon: true,
      type: 'WMS',
      url: 'https://ags.cuzk.gov.cz/arcgis/services/ZABAGED_POLOHOPIS/MapServer/WMSServer?',
      crs: 'EPSG:3857',
      bbox: [12.0, 48.5, 18.9, 51.1],
      format: 'image/png',
      transparent: true,
      area: 'CZ',
      abstract: 'ZABAGED® polohopis — land cover / forest and water (two stacks; ids from ZABAGED_POLOHOPIS GetCapabilities).',
      attribution: 'ČÚZK ZABAGED®',
      queryable: false,
      default_layers: ['0,1,2,3,4,5,6,7,8,9,10,11,128,129,130,131,132', '12,13,50,51,52,53,54,31,124,125,126,127'],
      layers: {
        '0,1,2,3,4,5,6,7,8,9,10,11,128,129,130,131,132': { queryable: false, title: 'Land cover, forest & vegetation' },
        '12,13,50,51,52,53,54,31,124,125,126,127': { queryable: false, title: 'Water bodies, shorelines, dams & springs' }
      }
    },
    {
      id: 42006,
      title: 'ČÚZK ZABAGED — Místní cesty',
      touId: 'cz-cuzk',
      favicon: true,
      type: 'WMS',
      url: 'https://ags.cuzk.gov.cz/arcgis/services/ZABAGED_POLOHOPIS/MapServer/WMSServer?',
      crs: 'EPSG:3857',
      bbox: [12.0, 48.5, 18.9, 51.1],
      format: 'image/png',
      transparent: true,
      area: 'CZ',
      abstract: 'ZABAGED® polohopis — streets, local roads and paths (two stacks; ids from ZABAGED_POLOHOPIS GetCapabilities).',
      attribution: 'ČÚZK ZABAGED®',
      queryable: false,
      default_layers: ['60,61,62,63,64,66', '65,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83'],
      layers: {
        '60,61,62,63,64,66': { queryable: false, title: 'Streets, paths & minor roads' },
        '65,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83': { queryable: false, title: 'Major roads, rail, bridges & crossings' }
      }
    },
    {
      id: 42007,
      title: 'ČÚZK GeoNames',
      touId: 'cz-cuzk',
      favicon: true,
      type: 'WMS',
      url: 'https://ags.cuzk.gov.cz/arcgis/services/GEONAMES/Geonames/MapServer/WMSServer?',
      crs: 'EPSG:3857',
      bbox: [12.0, 48.5, 18.9, 51.1],
      format: 'image/png',
      transparent: true,
      area: 'CZ',
      abstract: 'ČÚZK GeoNames geographic names (ArcGIS WMS GEONAMES/Geonames, EPSG:3857).',
      attribution: 'ČÚZK',
      queryable: false,
      default_layers: ['8', '9', '10', '11', '12', '13', '14', '19', '22', '23', '24'],
      layers: {
        0: { queryable: false, title: 'Border names' },
        1: { queryable: false, title: 'Other names' },
        2: { queryable: false, title: 'Industry & extraction sites' },
        3: { queryable: false, title: 'Accommodation & catering' },
        4: { queryable: false, title: 'Medical & spa facilities' },
        5: { queryable: false, title: 'Sports facilities' },
        6: { queryable: false, title: 'Cemeteries' },
        7: { queryable: false, title: 'Sacred objects' },
        8: { queryable: false, title: 'Castles, châteaux, fortifications' },
        9: { queryable: false, title: 'Cultural facilities' },
        10: { queryable: false, title: 'Telecom structures' },
        11: { queryable: false, title: 'Airports' },
        12: { queryable: false, title: 'Water transport' },
        13: { queryable: false, title: 'Land transport' },
        14: { queryable: false, title: 'Surface & vegetation' },
        15: { queryable: false, title: 'Other landforms' },
        16: { queryable: false, title: 'Large landforms' },
        17: { queryable: false, title: 'Other water infrastructure' },
        18: { queryable: false, title: 'Other watercourses & water bodies' },
        19: { queryable: false, title: 'Rivers & large water bodies' },
        20: { queryable: false, title: 'Regions' },
        21: { queryable: false, title: 'Protected nature areas' },
        22: { queryable: false, title: 'Local parts (settlements)' },
        23: { queryable: false, title: 'Parts of towns & municipalities' },
        24: { queryable: false, title: 'Towns & municipalities' }
      }
    },
    {
      id: 42008,
      title: 'ČÚZK Přehledová mapa',
      touId: 'cz-cuzk',
      favicon: true,
      type: 'WMS',
      url: 'https://ags.cuzk.gov.cz/arcgis1/services/PrehledovaMapa/MapServer/WMSServer?',
      crs: 'EPSG:3857',
      bbox: [12.0, 48.5, 18.9, 51.1],
      format: 'image/png',
      transparent: false,
      area: 'CZ',
      abstract: 'ČÚZK national overview basemap (PrehledovaMapa, Web Mercator).',
      attribution: 'ČÚZK',
      queryable: false,
      default_layers: ['0'],
      layers: {
        0: { queryable: false, title: 'Overview map' }
      }
    },
    {
      id: 96801,
      title: 'Oman National Basemap (EN) Transparent with Major Landmarks',
      touId: 'none',
      type: 'WMS',
      url: 'https://nsdig2gapps.ncsi.gov.om/arcgis1/services/Geoportal/BaseMapTransparentLandmarksEN/MapServer/WmsServer',
      crs: 'EPSG:3857',
      bbox: [46.23671, 12.997039, 66.795257, 30.129168],
      format: 'image/png',
      area: 'OM',
      abstract: 'National Basemap Transparent with Major Landmarks',
      attribution: 'NCSI',
      pixelManipulations: ['traceGrayscalePixels'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['1', '2', '3', '5', '6', '7', '8', '9', '10', '12', '13', '14', '15', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '33', '34', '35', '36', '37', '39', '40', '41', '42', '43', '45', '47', '48', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83', '84', '85', '86', '87', '88', '89', '91', '92', '93', '94', '95', '96', '97', '98', '99', '100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112', '113', '114', '115', '116', '117', '118', '119', '120', '121', '122', '123', '124', '125', '126', '127', '128', '129', '130'],
      layers: {
        '1': { queryable: true, title: 'Name of Ocean', abstract: 'Name of Ocean' },
        '2': { queryable: true, title: 'World Ocean', abstract: 'World Ocean' },
        '3': { queryable: true, title: 'World Countries', abstract: 'World Countries' },
        '5': { queryable: true, title: 'Country Boundary', abstract: 'Country Boundary' },
        '6': { queryable: true, title: 'Governorate ', abstract: 'Governorate ' },
        '7': { queryable: true, title: 'Willayat', abstract: 'Willayat' },
        '8': { queryable: true, title: 'Governorate Center', abstract: 'Governorate Center' },
        '9': { queryable: true, title: 'Willayat Center', abstract: 'Willayat Center' },
        '10': { queryable: true, title: 'Town Center', abstract: 'Town Center' },
        '12': { queryable: true, title: 'Rock', abstract: 'Rock' },
        '13': { queryable: true, title: 'Sand Dunes', abstract: 'Sand Dunes' },
        '14': { queryable: true, title: 'Builtup Area', abstract: 'Builtup Area' },
        '15': { queryable: true, title: 'Vegetation', abstract: 'Vegetation' },
        '17': { queryable: true, title: 'Reservoir', abstract: 'Reservoir' },
        '18': { queryable: true, title: 'Marsh Swamp', abstract: 'Marsh Swamp' },
        '19': { queryable: true, title: 'Sabkha', abstract: 'Sabkha' },
        '20': { queryable: true, title: 'Lake Pond', abstract: 'Lake Pond' },
        '21': { queryable: true, title: 'Lagoon', abstract: 'Lagoon' },
        '22': { queryable: true, title: 'Wadi Stream', abstract: 'Wadi Stream' },
        '23': { queryable: true, title: 'Wadi Spread', abstract: 'Wadi Spread' },
        '24': { queryable: true, title: 'Dam', abstract: 'Dam' },
        '25': { queryable: true, title: 'Foreshore', abstract: 'Foreshore' },
        '26': { queryable: true, title: 'Beach', abstract: 'Beach' },
        '27': { queryable: true, title: 'Ditch', abstract: 'Ditch' },
        '28': { queryable: true, title: 'Weir', abstract: 'Weir' },
        '29': { queryable: true, title: 'Sluice Gate', abstract: 'Sluice Gate' },
        '30': { queryable: true, title: 'Waterfall', abstract: 'Waterfall' },
        '31': { queryable: true, title: 'Spring', abstract: 'Spring' },
        '33': { queryable: true, title: 'Road Centre Lines', abstract: 'Road Centre Lines' },
        '34': { queryable: true, title: 'Road Centre Lines', abstract: 'Road Centre Lines' },
        '35': { queryable: true, title: 'Streets', abstract: 'Streets' },
        '36': { queryable: true, title: 'Minor Roads', abstract: 'Minor Roads' },
        '37': { queryable: true, title: 'Major Roads', abstract: 'Major Roads' },
        '39': { queryable: true, title: 'Amusement Parks', abstract: 'Amusement Parks' },
        '40': { queryable: true, title: 'Golf Courses', abstract: 'Golf Courses' },
        '41': { queryable: true, title: 'Parks', abstract: 'Parks' },
        '42': { queryable: true, title: 'Racing Tracks', abstract: 'Racing Tracks' },
        '43': { queryable: true, title: 'Sports Fields', abstract: 'Sports Fields' },
        '45': { queryable: true, title: 'Archeological Sites', abstract: 'Archeological Sites' },
        '47': { queryable: true, title: 'Buildings', abstract: 'Buildings' },
        '48': { queryable: true, title: 'Wall and Fences', abstract: 'Wall and Fences' },
        '50': { queryable: true, title: 'Consulates', abstract: 'Consulates' },
        '51': { queryable: true, title: 'International Missions', abstract: 'International Missions' },
        '52': { queryable: true, title: 'Embassies', abstract: 'Embassies' },
        '53': { queryable: true, title: 'Money Exchange', abstract: 'Money Exchange' },
        '54': { queryable: true, title: 'Stock Exchange', abstract: 'Stock Exchange' },
        '55': { queryable: true, title: 'Banks', abstract: 'Banks' },
        '56': { queryable: true, title: 'Fuel Stations', abstract: 'Fuel Stations' },
        '57': { queryable: true, title: 'Department Stores', abstract: 'Department Stores' },
        '58': { queryable: true, title: 'Shopping Mall Locations', abstract: 'Shopping Mall Locations' },
        '59': { queryable: true, title: 'Market Locations', abstract: 'Market Locations' },
        '60': { queryable: true, title: 'Ambulance Station', abstract: 'Ambulance Station' },
        '61': { queryable: true, title: 'Civil Defense Centers', abstract: 'Civil Defense Centers' },
        '62': { queryable: true, title: 'Police Station', abstract: 'Police Station' },
        '63': { queryable: true, title: 'Government Offices', abstract: 'Government Offices' },
        '64': { queryable: true, title: 'College Locations', abstract: 'College Locations' },
        '65': { queryable: true, title: 'Training Centers', abstract: 'Training Centers' },
        '66': { queryable: true, title: 'University Locations', abstract: 'University Locations' },
        '67': { queryable: true, title: 'School Locations', abstract: 'School Locations' },
        '68': { queryable: true, title: 'Health Centers', abstract: 'Health Centers' },
        '69': { queryable: true, title: 'Hospital Locations', abstract: 'Hospital Locations' },
        '70': { queryable: true, title: 'Diagnostic Centers', abstract: 'Diagnostic Centers' },
        '71': { queryable: true, title: 'Churches', abstract: 'Churches' },
        '72': { queryable: true, title: 'Temples', abstract: 'Temples' },
        '73': { queryable: true, title: 'Shrines', abstract: 'Shrines' },
        '74': { queryable: true, title: 'Mosques', abstract: 'Mosques' },
        '75': { queryable: true, title: 'Amusement Parks', abstract: 'Amusement Parks' },
        '76': { queryable: true, title: 'Beach Location', abstract: 'Beach Location' },
        '77': { queryable: true, title: 'Cinema Theaters', abstract: 'Cinema Theaters' },
        '78': { queryable: true, title: 'Skating Centers', abstract: 'Skating Centers' },
        '79': { queryable: true, title: 'Bowling Centers', abstract: 'Bowling Centers' },
        '80': { queryable: true, title: 'Theaters', abstract: 'Theaters' },
        '81': { queryable: true, title: 'Cultural Facilities', abstract: 'Cultural Facilities' },
        '82': { queryable: true, title: 'Museums', abstract: 'Museums' },
        '83': { queryable: true, title: 'Park Locations', abstract: 'Park Locations' },
        '84': { queryable: true, title: 'Convention Centers', abstract: 'Convention Centers' },
        '85': { queryable: true, title: 'Resturants', abstract: 'Resturants' },
        '86': { queryable: true, title: 'Hotels', abstract: 'Hotels' },
        '87': { queryable: true, title: 'Archeological Site Locations', abstract: 'Archeological Site Locations' },
        '88': { queryable: true, title: 'FerryTerminals', abstract: 'FerryTerminals' },
        '89': { queryable: true, title: 'Airport Locations', abstract: 'Airport Locations' },
        '91': { queryable: true, title: 'Consulates', abstract: 'Consulates' },
        '92': { queryable: true, title: 'International Missions', abstract: 'International Missions' },
        '93': { queryable: true, title: 'Embassies', abstract: 'Embassies' },
        '94': { queryable: true, title: 'Money Exchange', abstract: 'Money Exchange' },
        '95': { queryable: true, title: 'Stock Exchange', abstract: 'Stock Exchange' },
        '96': { queryable: true, title: 'Banks', abstract: 'Banks' },
        '97': { queryable: true, title: 'Fuel Stations', abstract: 'Fuel Stations' },
        '98': { queryable: true, title: 'Department Stores', abstract: 'Department Stores' },
        '99': { queryable: true, title: 'Shopping Mall Locations', abstract: 'Shopping Mall Locations' },
        '100': { queryable: true, title: 'Market Locations', abstract: 'Market Locations' },
        '101': { queryable: true, title: 'Ambulance Station', abstract: 'Ambulance Station' },
        '102': { queryable: true, title: 'Civil Defense Centers', abstract: 'Civil Defense Centers' },
        '103': { queryable: true, title: 'Police Station', abstract: 'Police Station' },
        '104': { queryable: true, title: 'Government Offices', abstract: 'Government Offices' },
        '105': { queryable: true, title: 'College Locations', abstract: 'College Locations' },
        '106': { queryable: true, title: 'Training Centers', abstract: 'Training Centers' },
        '107': { queryable: true, title: 'University Locations', abstract: 'University Locations' },
        '108': { queryable: true, title: 'School Locations', abstract: 'School Locations' },
        '109': { queryable: true, title: 'Health Centers', abstract: 'Health Centers' },
        '110': { queryable: true, title: 'Hospital Locations', abstract: 'Hospital Locations' },
        '111': { queryable: true, title: 'Diagnostic Centers', abstract: 'Diagnostic Centers' },
        '112': { queryable: true, title: 'Churches', abstract: 'Churches' },
        '113': { queryable: true, title: 'Temples', abstract: 'Temples' },
        '114': { queryable: true, title: 'Shrines', abstract: 'Shrines' },
        '115': { queryable: true, title: 'Mosques', abstract: 'Mosques' },
        '116': { queryable: true, title: 'Amusement Parks', abstract: 'Amusement Parks' },
        '117': { queryable: true, title: 'Beach Location', abstract: 'Beach Location' },
        '118': { queryable: true, title: 'Cinema Theaters', abstract: 'Cinema Theaters' },
        '119': { queryable: true, title: 'Skating Centers', abstract: 'Skating Centers' },
        '120': { queryable: true, title: 'Bowling Centers', abstract: 'Bowling Centers' },
        '121': { queryable: true, title: 'Theaters', abstract: 'Theaters' },
        '122': { queryable: true, title: 'Cultural Facilities', abstract: 'Cultural Facilities' },
        '123': { queryable: true, title: 'Museums', abstract: 'Museums' },
        '124': { queryable: true, title: 'Park Locations', abstract: 'Park Locations' },
        '125': { queryable: true, title: 'Convention Centers', abstract: 'Convention Centers' },
        '126': { queryable: true, title: 'Resturants', abstract: 'Resturants' },
        '127': { queryable: true, title: 'Hotels', abstract: 'Hotels' },
        '128': { queryable: true, title: 'Archeological Site Locations', abstract: 'Archeological Site Locations' },
        '129': { queryable: true, title: 'FerryTerminals', abstract: 'FerryTerminals' },
        '130': { queryable: true, title: 'Airport Locations', abstract: 'Airport Locations' }
      }
    },
    {
      id: 96802,
      title: 'Oman National Basemap (AR) Transparent with Major Landmarks',
      touId: 'none',
      type: 'WMS',
      url: 'https://nsdig2gapps.ncsi.gov.om/arcgis1/services/Geoportal/BaseMapTransparentLandmarksAR/MapServer/WmsServer',
      crs: 'EPSG:3857',
      bbox: [46.23671, 12.997039, 66.795257, 30.129168],
      format: 'image/png',
      area: 'OM',
      abstract: 'National Basemap Transparent with Major Landmarks',
      attribution: 'NCSI',
      pixelManipulations: ['traceGrayscalePixels'],
      queryable: true,
      query_filters: [ applyAllTransformations ],
      default_layers: ['1', '2', '3', '5', '6', '7', '8', '9', '10', '12', '13', '14', '15', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '33', '34', '35', '36', '37', '39', '40', '41', '42', '43', '45', '47', '48', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83', '84', '85', '86', '87', '88', '89', '91', '92', '93', '94', '95', '96', '97', '98', '99', '100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112', '113', '114', '115', '116', '117', '118', '119', '120', '121', '122', '123', '124', '125', '126', '127', '128', '129', '130'],
      layers: {
        '1': { queryable: true, title: 'Name of Ocean', abstract: 'أسماء المحيطات' },
        '2': { queryable: true, title: 'World Ocean', abstract: 'المحيطات' },
        '3': { queryable: true, title: 'World Countries', abstract: 'دول العالم' },
        '5': { queryable: true, title: 'Country Boundary', abstract: 'حدود السلطنة' },
        '6': { queryable: true, title: 'Governorate ', abstract: 'المحافظات' },
        '7': { queryable: true, title: 'Willayat', abstract: 'الولايات' },
        '8': { queryable: true, title: 'Governorate Center', abstract: 'مركز المحافظة' },
        '9': { queryable: true, title: 'Willayat Center', abstract: 'مركز الولاية' },
        '10': { queryable: true, title: 'Town Center', abstract: 'مركز المدينة' },
        '12': { queryable: true, title: 'Rock', abstract: 'تجمعات صخرية' },
        '13': { queryable: true, title: 'Sand Dunes', abstract: 'الكثبان الرملية' },
        '14': { queryable: true, title: 'Builtup Area', abstract: 'الإمتدادات العمرانية' },
        '15': { queryable: true, title: 'Vegetation', abstract: 'الغطاء النباتي' },
        '17': { queryable: true, title: 'Reservoir', abstract: 'خزانات المياه' },
        '18': { queryable: true, title: 'Marsh Swamp', abstract: 'مستنقعات' },
        '19': { queryable: true, title: 'Sabkha', abstract: 'السبخات' },
        '20': { queryable: true, title: 'Lake Pond', abstract: 'برك المياه' },
        '21': { queryable: true, title: 'Lagoon', abstract: 'بحيرات ملحية' },
        '22': { queryable: true, title: 'Wadi Stream', abstract: 'مسارات الأودية' },
        '23': { queryable: true, title: 'Wadi Spread', abstract: 'الأودية' },
        '24': { queryable: true, title: 'Dam', abstract: 'سدود' },
        '25': { queryable: true, title: 'Foreshore', abstract: 'حد الساحل' },
        '26': { queryable: true, title: 'Beach', abstract: 'الشواطئ' },
        '27': { queryable: true, title: 'Ditch', abstract: 'خنادق' },
        '28': { queryable: true, title: 'Weir', abstract: 'مصدات المياه' },
        '29': { queryable: true, title: 'Sluice Gate', abstract: 'بوابات التصريف' },
        '30': { queryable: true, title: 'Waterfall', abstract: 'الشلالات' },
        '31': { queryable: true, title: 'Spring', abstract: 'ينابيع' },
        '33': { queryable: true, title: 'Road Centre Lines', abstract: 'خطوط منتصف الطرق' },
        '34': { queryable: true, title: 'Road Centre Lines', abstract: 'خطوط منتصف الطرق' },
        '35': { queryable: true, title: 'Streets', abstract: 'الشوارع' },
        '36': { queryable: true, title: 'Minor Roads', abstract: 'الطرق الثانوية' },
        '37': { queryable: true, title: 'Major Roads', abstract: 'الطرق الرئيسية' },
        '39': { queryable: true, title: 'Amusement Parks', abstract: 'المتنزهات الترفيهية' },
        '40': { queryable: true, title: 'Golf Courses', abstract: 'ملاعب الجولف' },
        '41': { queryable: true, title: 'Parks', abstract: 'الحدائق' },
        '42': { queryable: true, title: 'Racing Tracks', abstract: 'مضامير السباق' },
        '43': { queryable: true, title: 'Sports Fields', abstract: 'الملاعب الرياضية' },
        '45': { queryable: true, title: 'Archeological Sites', abstract: 'المواقع الأثرية' },
        '47': { queryable: true, title: 'Buildings', abstract: 'المباني' },
        '48': { queryable: true, title: 'Wall and Fences', abstract: 'الأسوار والأسيجة' },
        '50': { queryable: true, title: 'Consulates', abstract: 'الهيئات الدبلوماسية' },
        '51': { queryable: true, title: 'International Missions', abstract: 'السفارات' },
        '52': { queryable: true, title: 'Embassies', abstract: 'القنصليات' },
        '53': { queryable: true, title: 'Money Exchange', abstract: 'سوق الأوراق المالية' },
        '54': { queryable: true, title: 'Stock Exchange', abstract: 'شركات الصرافة' },
        '55': { queryable: true, title: 'Banks', abstract: 'البنوك' },
        '56': { queryable: true, title: 'Fuel Stations', abstract: 'محطات الوقود' },
        '57': { queryable: true, title: 'Department Stores', abstract: 'مواقع الاسواق' },
        '58': { queryable: true, title: 'Shopping Mall Locations', abstract: 'المتاجر متعددة الأقسام' },
        '59': { queryable: true, title: 'Market Locations', abstract: 'مواقع المراكز التجارية' },
        '60': { queryable: true, title: 'Ambulance Station', abstract: 'مراكز الاسعاف' },
        '61': { queryable: true, title: 'Civil Defense Centers', abstract: 'مراكز الدفاع المدني' },
        '62': { queryable: true, title: 'Police Station', abstract: 'مراكز الشرطة' },
        '63': { queryable: true, title: 'Government Offices', abstract: 'مواقع الجهات الحكومية' },
        '64': { queryable: true, title: 'College Locations', abstract: 'مراكز التدريب والتأهيل' },
        '65': { queryable: true, title: 'Training Centers', abstract: 'مواقع الكليات' },
        '66': { queryable: true, title: 'University Locations', abstract: 'مواقع الجامعات' },
        '67': { queryable: true, title: 'School Locations', abstract: 'مواقع المدارس' },
        '68': { queryable: true, title: 'Health Centers', abstract: 'المراكز الصحية' },
        '69': { queryable: true, title: 'Hospital Locations', abstract: 'مواقع المستشفيات' },
        '70': { queryable: true, title: 'Diagnostic Centers', abstract: 'مراكز التشخيص الطبي' },
        '71': { queryable: true, title: 'Churches', abstract: 'الأضرحة' },
        '72': { queryable: true, title: 'Temples', abstract: 'الكنائس' },
        '73': { queryable: true, title: 'Shrines', abstract: 'المعابد' },
        '74': { queryable: true, title: 'Mosques', abstract: 'المساجد' },
        '75': { queryable: true, title: 'Amusement Parks', abstract: 'المتنزهات الترفيهية' },
        '76': { queryable: true, title: 'Beach Location', abstract: 'مواقع الشواطئ' },
        '77': { queryable: true, title: 'Cinema Theaters', abstract: 'دور السينما' },
        '78': { queryable: true, title: 'Skating Centers', abstract: 'مراكز التزلج' },
        '79': { queryable: true, title: 'Bowling Centers', abstract: 'مراكز البولينج' },
        '80': { queryable: true, title: 'Theaters', abstract: 'المسارح' },
        '81': { queryable: true, title: 'Cultural Facilities', abstract: 'المواقع الثقافية' },
        '82': { queryable: true, title: 'Museums', abstract: 'المتاحف' },
        '83': { queryable: true, title: 'Park Locations', abstract: 'مواقع الحدائق' },
        '84': { queryable: true, title: 'Convention Centers', abstract: 'مراكز المؤتمرات' },
        '85': { queryable: true, title: 'Resturants', abstract: 'المطاعم' },
        '86': { queryable: true, title: 'Hotels', abstract: 'الفنادق' },
        '87': { queryable: true, title: 'Archeological Site Locations', abstract: 'المواقع الأثرية - النقاط' },
        '88': { queryable: true, title: 'FerryTerminals', abstract: 'محطات العبارات' },
        '89': { queryable: true, title: 'Airport Locations', abstract: 'المطارات' },
        '91': { queryable: true, title: 'Consulates', abstract: 'الهيئات الدبلوماسية' },
        '92': { queryable: true, title: 'International Missions', abstract: 'السفارات' },
        '93': { queryable: true, title: 'Embassies', abstract: 'القنصليات' },
        '94': { queryable: true, title: 'Money Exchange', abstract: 'سوق الأوراق المالية' },
        '95': { queryable: true, title: 'Stock Exchange', abstract: 'شركات الصرافة' },
        '96': { queryable: true, title: 'Banks', abstract: 'البنوك' },
        '97': { queryable: true, title: 'Fuel Stations', abstract: 'محطات الوقود' },
        '98': { queryable: true, title: 'Department Stores', abstract: 'مواقع الاسواق' },
        '99': { queryable: true, title: 'Shopping Mall Locations', abstract: 'المتاجر متعددة الأقسام' },
        '100': { queryable: true, title: 'Market Locations', abstract: 'مواقع المراكز التجارية' },
        '101': { queryable: true, title: 'Ambulance Station', abstract: 'مراكز الاسعاف' },
        '102': { queryable: true, title: 'Civil Defense Centers', abstract: 'مراكز الدفاع المدني' },
        '103': { queryable: true, title: 'Police Station', abstract: 'مراكز الشرطة' },
        '104': { queryable: true, title: 'Government Offices', abstract: 'مواقع الجهات الحكومية' },
        '105': { queryable: true, title: 'College Locations', abstract: 'مراكز التدريب والتأهيل' },
        '106': { queryable: true, title: 'Training Centers', abstract: 'مواقع الكليات' },
        '107': { queryable: true, title: 'University Locations', abstract: 'مواقع الجامعات' },
        '108': { queryable: true, title: 'School Locations', abstract: 'مواقع المدارس' },
        '109': { queryable: true, title: 'Health Centers', abstract: 'المراكز الصحية' },
        '110': { queryable: true, title: 'Hospital Locations', abstract: 'مواقع المستشفيات' },
        '111': { queryable: true, title: 'Diagnostic Centers', abstract: 'مراكز التشخيص الطبي' },
        '112': { queryable: true, title: 'Churches', abstract: 'الأضرحة' },
        '113': { queryable: true, title: 'Temples', abstract: 'الكنائس' },
        '114': { queryable: true, title: 'Shrines', abstract: 'المعابد' },
        '115': { queryable: true, title: 'Mosques', abstract: 'المساجد' },
        '116': { queryable: true, title: 'Amusement Parks', abstract: 'المتنزهات الترفيهية' },
        '117': { queryable: true, title: 'Beach Location', abstract: 'مواقع الشواطئ' },
        '118': { queryable: true, title: 'Cinema Theaters', abstract: 'دور السينما' },
        '119': { queryable: true, title: 'Skating Centers', abstract: 'مراكز التزلج' },
        '120': { queryable: true, title: 'Bowling Centers', abstract: 'مراكز البولينج' },
        '121': { queryable: true, title: 'Theaters', abstract: 'المسارح' },
        '122': { queryable: true, title: 'Cultural Facilities', abstract: 'المواقع الثقافية' },
        '123': { queryable: true, title: 'Museums', abstract: 'المتاحف' },
        '124': { queryable: true, title: 'Park Locations', abstract: 'مواقع الحدائق' },
        '125': { queryable: true, title: 'Convention Centers', abstract: 'مراكز المؤتمرات' },
        '126': { queryable: true, title: 'Resturants', abstract: 'المطاعم' },
        '127': { queryable: true, title: 'Hotels', abstract: 'الفنادق' },
        '128': { queryable: true, title: 'Archeological Site Locations', abstract: 'المواقع الأثرية - النقاط' },
        '129': { queryable: true, title: 'FerryTerminals', abstract: 'محطات العبارات' },
        '130': { queryable: true, title: 'Airport Locations', abstract: 'المطارات' }
      }
    }
  ].sort((a, b) => a.title.localeCompare(b.title))
    .sort((a, b) => a.area.localeCompare(b.area))
    .forEach((map) => maps.set(map.id, map));
  //#endregion

  //#region Utility classes
// --- TERMS OF USE REGISTRY ---
  const TOU_REGISTRY = {
    'al-asig': { name: 'ASIG Geoportal Terms of Use', links: { 'en': 'https://geoportal.asig.gov.al/en/info/terms', 'sq': 'https://geoportal.asig.gov.al/sq/info/kusht' }, selector: '.page-content' },
    'waze-internal': { name: 'Waze Terms of Service', links: { 'en': 'https://www.waze.com/legal/tos' }, selector: 'main' },
    'google-mymaps': { name: 'Google Maps / My Maps — Terms', links: { 'en': 'https://www.google.com/intl/en/help/terms_maps/' }, selector: 'main' },
    'eu-tentec': { name: 'European Commission Legal Notice', links: { 'en': 'https://commission.europa.eu/legal-notice_en' }, selector: 'main' },
    'unesco': { name: 'UNESCO World Heritage Centre — Licenses & Conditions', links: { 'en': 'https://whc.unesco.org/en/licenses/' }, selector: 'main' },
    'us-wvu': { name: 'West Virginia GIS Clearinghouse Terms', links: { 'en': 'https://www.mapwv.gov/terms.html' }, selector: 'body' },
    'us-usgs': { name: 'USGS Public Domain Policy', links: { 'en': 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits' }, selector: '.main-content' },
    'us-vgin': { name: 'Virginia VGIN Data Usage Terms', links: { 'en': 'https://vgin.vdem.virginia.gov/pages/cl-vgin-data-usage' }, selector: 'main' },
    'us-tnmap': { name: 'TN.gov Policies & Disclaimer', links: { 'en': 'https://www.tn.gov/help/policies/disclaimer.html' }, selector: 'main' },
    'us-pasda': { name: 'PASDA Open Data Policy', links: { 'en': 'https://www.pasda.psu.edu/about.html' }, selector: '#content' },
    'us-nconemap': { name: 'NC OneMap Terms', links: { 'en': 'https://www.nconemap.gov/pages/terms' }, selector: '.markdown-body' },
    'us-indianamap': { name: 'IndianaMap Open Data Terms', links: { 'en': 'https://www.in.gov/core/policies.html' }, selector: 'main' },
    'us-mdimap': { name: 'Maryland Open Data Terms', links: { 'en': 'https://www.maryland.gov/terms-use' }, selector: '.markdown-body' },
    'nl-pdok': { name: 'PDOK Algemene Voorwaarden', links: { 'nl': 'https://www.pdok.nl/algemene-voorwaarden' }, selector: 'main' },
    'nl-rws': { name: 'Rijkswaterstaat Open Data', links: { 'nl': 'https://www.rijkswaterstaat.nl/algemene-voorwaarden' }, selector: 'main' },
    'be-vlaanderen': { name: 'Gratis Open Data Licentie Vlaanderen', links: { 'nl': 'https://www.vlaanderen.be/digitaal-vlaanderen/onze-diensten-en-platformen/open-data/voorwaarden-voor-het-hergebruik-van-overheidsinformatie/modellicentie-gratis-hergebruik' }, selector: 'main' },
    'be-wallonie': { name: 'Géoportail de la Wallonie Mentions Légales', links: { 'fr': 'https://geoportail.wallonie.be/mentions-legales' }, selector: 'main' },
    'be-urbis': { name: 'UrbIS License (Paradigm)', links: { 'en': 'https://datastore.brussels/web/about', 'fr': 'https://datastore.brussels/web/about', 'nl': 'https://datastore.brussels/web/about' }, selector: 'main' },
    'be-mobility': { name: 'Brussels Mobility Open Data', links: { 'en': 'https://data.mobility.brussels/licence/' }, selector: 'main' },
    'be-minfin': { name: 'FPS Finances Open Data Terms', links: { 'fr': 'https://finances.belgium.be/fr/sur_le_spf/open-data', 'nl': 'https://financien.belgium.be/nl/over_de_fod/open-data' }, selector: 'main' },
    'cz-cuzk': { name: 'ČÚZK Conditions for Network Services', links: { 'en': 'https://cuzk.gov.cz/English/Practical-Information/Conditions-of-Provision-for-Spatial-Data-and-Netwo/Conditions-for-Provision-of-CUZK-Network-Services.aspx', 'cs': 'https://www.cuzk.cz/Predpisy/Podminky-poskytovani-prostor-dat-a-sitovych-sluzeb/Podminky-poskytovani-prostorovych-dat-CUZK.aspx' }, selector: 'main' }
  };

// --- TERMS OF USE HELPER ---
  var touUnreachableSessionDismissed = Object.create(null);

  function isTouAccepted(touId) {
    if (touId === 'none') return true; // Explicitly declared as no ToU required
    if (!touId || !TOU_REGISTRY[touId]) return false; // Missing or invalid ToU = LOCKED
    var s = Settings.get();
    if (s.state.acceptedToUs && s.state.acceptedToUs[touId]) return true;
    return !!touUnreachableSessionDismissed[touId];
  }

  function hasStoredTouAcceptance(touId) {
    if (touId === 'none') return true;
    if (!touId || !TOU_REGISTRY[touId]) return false;
    var s = Settings.get();
    return !!(s.state.acceptedToUs && s.state.acceptedToUs[touId]);
  }

// --- MODERN ASYNC REQUEST WRAPPER ---
  const omFetch = (options) => new Promise((resolve, reject) => {
    GM_xmlhttpRequest({ ...options, onload: resolve, onerror: reject, ontimeout: reject });
  });

  function formatTouFetchError(err) {
    if (err == null) return 'Request failed';
    if (typeof err === 'string') return err;
    if (typeof err === 'object') {
      if (err.message) return String(err.message);
      if (err.error) return String(err.error);
      if (err.statusText) return String(err.statusText);
      if (err.status != null) return 'Request failed (HTTP ' + err.status + ')';
    }
    return String(err);
  }

  function formatTouUnreachableDetail(res) {
    var msg = res.msg;
    if (msg != null && typeof msg === 'object') {
      msg = msg.message || msg.error || JSON.stringify(msg);
    }
    msg = (msg == null || msg === '') ? 'Network or connection error.' : String(msg);
    if (res.httpStatus != null) {
      return 'HTTP ' + res.httpStatus + ' — ' + msg.replace(/^HTTP\s+\d+\s*[—\-]?\s*/i, '');
    }
    return msg;
  }

  /** Fetch ToU URL without requiring prior acceptance (for first-load UI probe). */
  async function probeToUReachability(touId, callback) {
    var result;
    const touObj = TOU_REGISTRY[touId];
    if (!touObj) {
      result = { status: 'invalid' };
    } else {
      const checkUrl = touObj.links[Object.keys(touObj.links)[0]];
      try {
        const res = await omFetch({ method: 'GET', url: checkUrl, timeout: 10000 });
        if (res.status !== 200) {
          result = { status: 'unreachable', httpStatus: res.status, msg: 'HTTP ' + res.status };
        } else {
          const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
          const el = doc.querySelector(touObj.selector) || doc.body;
          if (!el) {
            result = { status: 'unreachable', httpStatus: res.status, msg: 'Selector not found' };
          } else {
            el.querySelectorAll('script, style, svg, nav, footer, header').forEach(function(n) { n.remove(); });
            var currentLen = el.textContent.replace(/\s+/g, ' ').trim().length;
            result = { status: 'ok', len: currentLen };
          }
        }
      } catch (err) {
        result = { status: 'unreachable', msg: formatTouFetchError(err) };
      }
    }
    if (callback) callback(result);
    return result;
  }

  async function performToUCheck(touId, force, callback) {
    const s = Settings.get();
    const touObj = TOU_REGISTRY[touId];
    if (!touObj || !s.state.acceptedToUs?.[touId]) return callback?.({ status: 'ignored' });

    let accData = s.state.acceptedToUs[touId];
    const now = Date.now();
    const checkInterval = 30 * 24 * 60 * 60 * 1000;

    // Upgrade legacy format
    if (typeof accData === 'number') {
      accData = { acceptedAt: accData, lastChecked: 0, length: 0 };
    }

    if (force || now - accData.lastChecked > checkInterval || accData.length === 0) {
      try {
        const checkUrl = touObj.links[Object.keys(touObj.links)[0]];
        const res = await omFetch({ method: 'GET', url: checkUrl, timeout: 10000 });

        if (res.status !== 200) {
          callback?.({ status: 'unreachable', httpStatus: res.status, msg: 'HTTP ' + res.status });
          return;
        }

        const doc = new DOMParser().parseFromString(res.responseText, "text/html");
        const el = doc.querySelector(touObj.selector) || doc.body;

        if (!el) {
          callback?.({ status: 'unreachable', httpStatus: res.status, msg: 'Selector not found' });
          return;
        }

        // Clean noise
        el.querySelectorAll('script, style, svg, nav, footer, header').forEach(n => n.remove());
        const currentLen = el.textContent.replace(/\s+/g, ' ').trim().length;

        if (accData.length === 0) {
          accData = { ...accData, length: currentLen, lastChecked: now };
          s.state.acceptedToUs[touId] = accData;
          Settings.put(s);
          window.dispatchEvent(new CustomEvent('om-tou-sync', { detail: { touId, accepted: true } }));
          callback?.({ status: 'baseline', len: currentLen });
        } else {
          const diff = Math.abs(currentLen - accData.length) / accData.length;
          if (diff > 0.03) {
            delete s.state.acceptedToUs[touId];
            Settings.put(s);
            window.dispatchEvent(new CustomEvent('om-tou-sync', { detail: { touId, accepted: false } }));
            callback?.({ status: 'revoked', diff });
          } else {
            accData.lastChecked = now;
            s.state.acceptedToUs[touId] = accData;
            Settings.put(s);
            window.dispatchEvent(new CustomEvent('om-tou-sync', { detail: { touId, accepted: true } }));
            callback?.({ status: 'unchanged', len: currentLen, diff });
          }
        }
      } catch (err) {
        callback?.({ status: 'unreachable', msg: formatTouFetchError(err) });
      }
    } else {
      callback?.({ status: 'skipped' });
    }
  }
  function runToUBackgroundChecks() {
    var s = Settings.get();
    if (!s.state.acceptedToUs) return;
    Object.keys(s.state.acceptedToUs).forEach(function(touId) {
      performToUCheck(touId, false); // Trigger silent background check
    });
  }


  var Settings = {
    'get': function() {
      var settings;
      if (localStorage.OpenMaps) {
        settings = JSON.parse(localStorage.OpenMaps);
      }
      if (!settings) {
        settings = {};
      }
      if (typeof settings.tooltips == 'undefined') {
        settings.tooltips = true;
      }
      if (!settings.state) {
        settings.state = {};
      }
      if (!settings.state.active) {
        settings.state.active = [];
    }
      // NEW: Ensure accepted ToUs object exists
      if (!settings.state.acceptedToUs) {
        settings.state.acceptedToUs = {};
      }
      if (!settings.state.touUnreachableBypass) {
        settings.state.touUnreachableBypass = {};
      }
      if (!settings.state.favoriteMapIds) {
        settings.state.favoriteMapIds = [];
      }
      if (!settings.state.userMaps) {
        settings.state.userMaps = [];
      }
      if (typeof settings.inspectorAutoWmsGetFeatureInfo === 'undefined') {
        settings.inspectorAutoWmsGetFeatureInfo = true;
      }
      return settings;
    },
    'put': function(obj) {
      localStorage.OpenMaps = JSON.stringify(obj);
    },
    'set': function(setting, value) {
      var settings = this.get();
      settings[setting] = value;
      this.put(settings);
    },
    'exists': function() {
      return typeof localStorage.OpenMaps != 'undefined';
    }
  };

  var Tooltips = (function() {
    var elements = [];
    var defaultOpts = { trigger: 'hover', container: 'body', placement: 'top' };

    function bsTooltipCtor() {
      return (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) ? bootstrap.Tooltip : null;
    }

    function disposeBsTooltip(el) {
      var T = bsTooltipCtor();
      if (T) {
        try {
          var inst = T.getInstance(el);
          if (inst) inst.dispose();
        } catch (errD) { /* ignore */ }
      }
      el.removeAttribute('data-bs-original-title');
      el.removeAttribute('data-original-title');
    }

    return {
      'add': function(element, text, force, tooltipOpts) {
        var opts = Object.assign({}, defaultOpts, tooltipOpts || {});
        var useHtml = !!opts.html;
        if (!Settings.get().tooltips && !force) {
          element.title = text;
          var regIdx = elements.indexOf(element);
          if (regIdx !== -1) elements.splice(regIdx, 1);
          element.dataset.title = text;
          elements.push(element);
          return;
        }
        disposeBsTooltip(element);
        if (!force) {
          var i = elements.indexOf(element);
          if (i !== -1) elements.splice(i, 1);
          element.dataset.title = text;
          elements.push(element);
        }
        var titleStr = useHtml ? String(text).replace(/\n/g, '<br>') : text;
        var T = bsTooltipCtor();
        if (!T) {
          if (useHtml) element.removeAttribute('title');
          else element.title = titleStr;
          return;
        }
        try {
          if (useHtml) element.removeAttribute('title');
          else element.title = titleStr;
          new T(element, {
            title: titleStr,
            html: useHtml,
            trigger: opts.trigger,
            container: opts.container,
            placement: opts.placement,
            sanitize: false
          });
        } catch (errInit) {
          if (useHtml) element.removeAttribute('title');
          else element.title = titleStr;
        }
      },
      'remove': function(element) {
        disposeBsTooltip(element);
        element.title = '';
        var toRemoveIdx = elements.findIndex(function(el) { return el == element; });
        if (toRemoveIdx !== -1) {
          elements.splice(toRemoveIdx, 1);
        }
      },
      'hide': function(element) {
        var T = bsTooltipCtor();
        if (!T) return;
        try {
          var inst = T.getInstance(element);
          if (inst) inst.hide();
        } catch (errH) { /* ignore */ }
      },
      /** Hide + destroy Bootstrap tooltips under root (e.g. before removing a map card). Only touches nodes that may have instances — not every descendant. */
      'teardownSubtree': function(root) {
        if (!root || !root.querySelectorAll) return;
        var list = [];
        var seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
        function add(el) {
          if (!el || el.nodeType !== 1) return;
          if (seen) {
            if (seen.has(el)) return;
            seen.add(el);
          } else if (list.indexOf(el) !== -1) return;
          list.push(el);
        }
        var tipSel = '[data-original-title], [data-bs-original-title], [data-toggle="tooltip"], [data-bs-toggle="tooltip"]';
        try {
          if (root.matches && root.matches(tipSel)) add(root);
          var q = root.querySelectorAll(tipSel);
          for (var i = 0; i < q.length; i++) add(q[i]);
        } catch (err0) {}
        for (var j = 0; j < elements.length; j++) {
          var regEl = elements[j];
          if (regEl && typeof root.contains === 'function' && root.contains(regEl)) add(regEl);
        }
        list.forEach(function(el) {
          var Th = bsTooltipCtor();
          if (Th) {
            try {
              var ti = Th.getInstance(el);
              if (ti) ti.hide();
            } catch (err1) { /* ignore */ }
          }
          disposeBsTooltip(el);
          el.removeAttribute('data-original-title');
          el.removeAttribute('data-bs-original-title');
          var idx = elements.indexOf(el);
          if (idx !== -1) elements.splice(idx, 1);
        });
      },
      'enabled': function() {
        return Settings.get().tooltips;
      },
      'toggle': function() {
        var isEnabled = Settings.get().tooltips;
        Settings.set('tooltips', !isEnabled);
        if (isEnabled) {
          elements.forEach(function(element) {
            disposeBsTooltip(element);
            element.title = '';
          });
        } else {
          elements.forEach(function(element) {
            element.title = element.dataset.title;
            Tooltips.add(element, element.dataset.title, false, {});
          });
        }
      }
    };
  })();

  var IDGenerator = (function() {
    var counter = 0;
    return {
      getNext: function() {
        return counter++;
      }
    };
  })();
  //#endregion

  var pendingUpdateNoticeMessage = null;

  //#region Check version
  // Convert from old storage object
  if (localStorage.OpenMaps_version) {
    Settings.set('version', localStorage.OpenMaps_version);
    localStorage.removeItem('OpenMaps_version');
  }
  var version = Settings.get().version,
      scriptVersion = GM_info.script.version;
  if (!version) {
    Settings.set('version', scriptVersion);
  } else if (version !== scriptVersion) {
    var versions = Object.keys(translations.en.update).map((version) => version.replace('v', '').replaceAll('_', '.'));
    if (versions.indexOf(version) === -1) {
      // The version has been tampered with if we arrive here, just set to current version
      log('The version number seems to have been tampered with? Ignoring and resetting');
      Settings.set('version', scriptVersion);
      return;
    }
    var message = I18n.t('openmaps.update.message');
    for (var i = versions.indexOf(version)+1; i < versions.length; i++) {
      message += '\nv' + versions[i] + ':\n' + I18n.t('openmaps.update.v' + versions[i].replace(/\./g, '_'));
    }
    Settings.set('version', scriptVersion);
    pendingUpdateNoticeMessage = message;
  }
  //#endregion

  // OpenLayers default is 0. Setting 1 retries failed tile images once globally (including WME basemap),
  // which doubles load on errors and can worsen Chrome net::ERR_INSUFFICIENT_RESOURCES when many
  // overlay layers compete for connections/decodes. Keep at 0.
  OpenLayers.IMAGE_RELOAD_ATTEMPTS = 0;

  // List of map handles
  var handles = [];

  /** Set by initOpenMapsInspector: ingest query results, refresh sources, etc. */
  var openMapsInspectorApi = null;

  /**
   * Same palette + hash as active-map avatars in the sidebar (see buildMainCard).
   * @param {string} title
   * @returns {string} hex color
   */
  function openMapsMapAvatarColorFromTitle(title) {
    if (!title || typeof title !== 'string') return '#0099ff';
    var hash = 0;
    for (var i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    var wazeColors = ['#0099ff', '#8663df', '#20c063', '#ff9600', '#ff6699', '#0071c5', '#15ccb2', '#33ccff', '#e040fb', '#ffc000', '#f44336', '#3f51b5', '#009688', '#8bc34a', '#e91e63'];
    return wazeColors[Math.abs(hash) % wazeColors.length];
  }

  /** Map Inspector list row color dot (`.openmaps-inspector-avatar` in CSS). */
  var OPENMAPS_INSPECTOR_LIST_AVATAR_PX = 16;

  /**
   * Sizing for ESRI_FEATURE markers: same hue as map avatars; symbol radius = 130% of the **list** avatar radius
   * (16px diameter in CSS), white outline +10% (relative to base outline).
   * @param {string} fillHex
   * @returns {Object}
   */
  function openMapsEsriFeatureAvatarMarkerPack(fillHex) {
    var hex = (fillHex && typeof fillHex === 'string') ? fillHex : '#0099ff';
    var listAvatarR = OPENMAPS_INSPECTOR_LIST_AVATAR_PX / 2;
    var symbolR = listAvatarR * 1.3;
    var whiteW = Math.max(1, Math.round(symbolR * 0.055));
    var highlightR = symbolR * 1.6 + whiteW * 0.1;
    var hlStroke = Math.max(2, Math.round(Math.max(whiteW, 2) * 1.05));
    return {
      fillHex: hex,
      symbolR: symbolR,
      whiteW: whiteW,
      highlightR: highlightR,
      hlStroke: hlStroke,
      polyStrokeW: Math.max(2, whiteW)
    };
  }

  /** OpenLayers `layer.name` for ESRI_FEATURE: unique per map row (`map.title` can duplicate across catalog entries). */
  function openMapsEsriFeatureVectorOlName(mapId) {
    return 'OpenMaps_ESRI_FEATURE_' + String(mapId);
  }

  /** OpenLayers `layer.name` for GOOGLE_MY_MAPS (unique per row; mirrors ESRI_FEATURE naming). */
  function openMapsGoogleMyMapsLayerOlName(mapId) {
    return 'OpenMaps_GOOGLE_MY_MAPS_' + String(mapId);
  }

  /** Remove KML vector from WME + `olMap` so a hidden / ToU-blocked row cannot leave a stale OL layer above aerial. */
  function openMapsGoogleMyMapsLayerRemoveFromMap(layer) {
    if (!layer) return;
    try {
      var olm = (typeof W !== 'undefined' && W.map && typeof W.map.getOLMap === 'function') ? W.map.getOLMap() : null;
      if (olm && olm.layers && olm.layers.indexOf(layer) >= 0 && typeof olm.removeLayer === 'function') olm.removeLayer(layer);
    } catch (e1) { /* ignore */ }
    try {
      openMapsGmmDiagOnGmmMapMutate('removeFromMap', layer);
    } catch (eD) { /* ignore */ }
  }

  function openMapsGoogleMyMapsLayerAddToMap(layer) {
    if (!layer) return;
    try {
      var olm = (typeof W !== 'undefined' && W.map && typeof W.map.getOLMap === 'function') ? W.map.getOLMap() : null;
      if (olm && olm.layers && olm.layers.indexOf(layer) === -1 && typeof olm.addLayer === 'function') olm.addLayer(layer);
    } catch (e1) { /* ignore */ }
    try {
      openMapsGmmDiagOnGmmMapMutate('addToMap', layer);
    } catch (eD) { /* ignore */ }
  }

  /**
   * Phase 1 — My Maps / satellite diagnostics (opt-in).
   * Enable: `localStorage.setItem('openmaps-gmm-diag','1')` then reload WME. Disable: removeItem + reload.
   * Or pre-load: `unsafeWindow.__OPEN_MAPS_GMM_DIAG__ = true` before the script runs.
   */
  var OPEN_MAPS_GMM_DIAG_STORAGE_KEY = 'openmaps-gmm-diag';
  var openMapsGmmDiagHelpLogged = false;

  function openMapsGmmDiagEnabled() {
    try {
      if (typeof unsafeWindow !== 'undefined' && unsafeWindow.__OPEN_MAPS_GMM_DIAG__) return true;
    } catch (eU) { /* ignore */ }
    try {
      return localStorage.getItem(OPEN_MAPS_GMM_DIAG_STORAGE_KEY) === '1';
    } catch (eL) {
      return false;
    }
  }

  function openMapsGmmDiagLog(tag, detail) {
    try {
      console.info('[OpenMaps GMM diag]', tag, detail !== undefined ? detail : '');
    } catch (eC) { /* ignore */ }
  }

  function openMapsGmmDiagPrintHelpOnce() {
    if (!openMapsGmmDiagEnabled() || openMapsGmmDiagHelpLogged) return;
    openMapsGmmDiagHelpLogged = true;
    openMapsGmmDiagLog(
      'HOWTO',
      'Reproduce the bug, save the console. Disable: localStorage.removeItem("' + OPEN_MAPS_GMM_DIAG_STORAGE_KEY + '"); location.reload()'
    );
  }

  function openMapsGmmDiagOlStackSnapshot(olMap, label) {
    if (!openMapsGmmDiagEnabled() || !olMap || !olMap.layers) return;
    var rows = [];
    var max = Math.min(olMap.layers.length, 80);
    for (var i = 0; i < max; i++) {
      var L = olMap.layers[i];
      var nm = (L && L.name != null) ? String(L.name) : '';
      var ix = -1;
      try {
        ix = typeof olMap.getLayerIndex === 'function' ? olMap.getLayerIndex(L) : i;
      } catch (eIx) { ix = i; }
      var vis = null;
      try {
        vis = L && typeof L.getVisibility === 'function' ? L.getVisibility() : null;
      } catch (eV) { vis = null; }
      rows.push({
        arrayIdx: i,
        stackIx: ix,
        name: nm.slice(0, 120),
        cls: L && L.CLASS_NAME ? L.CLASS_NAME : '',
        vis: vis
      });
    }
    openMapsGmmDiagLog('OL stack: ' + label, {
      total: olMap.layers.length,
      shown: max,
      layers: rows
    });
  }

  function openMapsGmmDiagIsOurOpenMapsLayerName(nameStr) {
    if (!nameStr) return false;
    return nameStr.indexOf('OpenMaps_') === 0 || nameStr.indexOf('BBOX_') === 0;
  }

  function openMapsGmmDiagMaybeWrapOlMapSetLayerIndex(olMap) {
    if (!openMapsGmmDiagEnabled() || !olMap || olMap.__openmapsGmmDiagSlIx) return;
    olMap.__openmapsGmmDiagSlIx = true;
    var inner = olMap.setLayerIndex;
    if (typeof inner !== 'function') return;
    olMap.setLayerIndex = function(layer, idx) {
      var nm = '';
      try {
        nm = layer && layer.name != null ? String(layer.name) : '';
      } catch (eN) { nm = ''; }
      if (!openMapsGmmDiagIsOurOpenMapsLayerName(nm)) {
        openMapsGmmDiagLog('setLayerIndex → non-OpenMaps layer', {
          name: nm,
          idx: idx,
          cls: layer && layer.CLASS_NAME ? layer.CLASS_NAME : ''
        });
      }
      return inner.apply(this, arguments);
    };
  }

  function openMapsGmmDiagMaybeWrapOlMapRemoveLayer(olMap) {
    if (!openMapsGmmDiagEnabled() || !olMap || olMap.__openmapsGmmDiagRm) return;
    olMap.__openmapsGmmDiagRm = true;
    var inner = olMap.removeLayer;
    if (typeof inner !== 'function') return;
    olMap.removeLayer = function(layer) {
      var nm = '';
      try {
        nm = layer && layer.name != null ? String(layer.name) : '';
      } catch (eN) { nm = ''; }
      if (!openMapsGmmDiagIsOurOpenMapsLayerName(nm)) {
        openMapsGmmDiagLog('removeLayer → non-OpenMaps layer', {
          name: nm,
          cls: layer && layer.CLASS_NAME ? layer.CLASS_NAME : ''
        });
      }
      return inner.apply(this, arguments);
    };
  }

  function openMapsGmmDiagMaybeWrapWMapRemoveLayer() {
    if (!openMapsGmmDiagEnabled() || typeof W === 'undefined' || !W.map || W.map.__openmapsGmmDiagWRm) return;
    W.map.__openmapsGmmDiagWRm = true;
    var wm = W.map;
    var inner = wm.removeLayer;
    if (typeof inner !== 'function') return;
    wm.removeLayer = function(layer) {
      var nm = '';
      try {
        nm = layer && layer.name != null ? String(layer.name) : '';
      } catch (eN) { nm = ''; }
      if (!openMapsGmmDiagIsOurOpenMapsLayerName(nm)) {
        openMapsGmmDiagLog('W.map.removeLayer → non-OpenMaps layer', {
          name: nm,
          cls: layer && layer.CLASS_NAME ? layer.CLASS_NAME : ''
        });
      }
      return inner.apply(this, arguments);
    };
  }

  function openMapsGmmDiagOnGmmMapMutate(op, layer) {
    if (!openMapsGmmDiagEnabled()) return;
    var olm = (typeof W !== 'undefined' && W.map && typeof W.map.getOLMap === 'function') ? W.map.getOLMap() : null;
    openMapsGmmDiagLog('GMM ' + op, {
      layerName: layer && layer.name != null ? String(layer.name) : null,
      olLayerCount: olm && olm.layers ? olm.layers.length : null
    });
    openMapsGmmDiagOlStackSnapshot(olm, 'after ' + op);
  }

  /** Default OpenLayers style for an ESRI_FEATURE point (shared by layer + lift clone). */
  function openMapsEsriPointVectorStyle(pack) {
    return {
      graphicName: 'circle',
      pointRadius: Math.max(4, Math.round(pack.symbolR)),
      fillColor: pack.fillHex,
      fillOpacity: 0.92,
      strokeColor: '#ffffff',
      strokeWidth: pack.whiteW,
      strokeOpacity: 1
    };
  }

  /**
   * Map Inspector overlay style for an ESRI_FEATURE clone (lines/polygons; points use halo+ring layers).
   * @param {OpenLayers.Geometry|null} geom
   * @param {string} avatarFill
   * @returns {Object}
   */
  function openMapsEsriInspectorHighlightStyle(geom, avatarFill) {
    var pack = openMapsEsriFeatureAvatarMarkerPack(avatarFill);
    if (!geom || !geom.CLASS_NAME) {
      return { strokeColor: '#ffffff', strokeWidth: pack.hlStroke, fillOpacity: 0.35, fillColor: pack.fillHex, strokeOpacity: 0.8 };
    }
    var cn = geom.CLASS_NAME;
    if (cn === 'OpenLayers.Geometry.Point' || cn === 'OpenLayers.Geometry.MultiPoint') {
      return null;
    }
    if (cn === 'OpenLayers.Geometry.LineString' || cn === 'OpenLayers.Geometry.MultiLineString' || cn === 'OpenLayers.Geometry.LinearRing') {
      return {
        strokeColor: '#ffffff',
        strokeWidth: Math.max(4, Math.round(pack.polyStrokeW * 2.5)),
        strokeOpacity: 0.8,
        fillOpacity: 0
      };
    }
    return {
      fillColor: pack.fillHex,
      fillOpacity: 0.42,
      strokeColor: '#ffffff',
      strokeWidth: Math.max(3, Math.round(pack.polyStrokeW * 2)),
      strokeOpacity: 0.8
    };
  }

  /**
   * Idle map style for geometry-only Map Inspector rows (WMS/WFS/query) drawn under hover/selection overlays.
   * @param {OpenLayers.Geometry|null} geom
   * @param {string} avatarFill
   * @returns {Object|null} null for point/multipoint (caller uses {@link openMapsEsriPointVectorStyle}).
   */
  function openMapsInspectorViewportGeomBaseStyle(geom, avatarFill) {
    var pack = openMapsEsriFeatureAvatarMarkerPack(avatarFill);
    if (!geom || !geom.CLASS_NAME) {
      return {
        strokeColor: pack.fillHex,
        strokeWidth: Math.max(2, pack.polyStrokeW),
        strokeOpacity: 0.55,
        fillColor: pack.fillHex,
        fillOpacity: 0.22
      };
    }
    var cn = geom.CLASS_NAME;
    if (cn === 'OpenLayers.Geometry.Point' || cn === 'OpenLayers.Geometry.MultiPoint') {
      return null;
    }
    if (cn === 'OpenLayers.Geometry.LineString' || cn === 'OpenLayers.Geometry.MultiLineString' || cn === 'OpenLayers.Geometry.LinearRing') {
      return {
        strokeColor: pack.fillHex,
        strokeWidth: Math.max(2, Math.round(pack.polyStrokeW * 1.6)),
        strokeOpacity: 0.72,
        fillOpacity: 0
      };
    }
    return {
      fillColor: pack.fillHex,
      fillOpacity: 0.22,
      strokeColor: pack.fillHex,
      strokeWidth: Math.max(2, pack.polyStrokeW),
      strokeOpacity: 0.5
    };
  }

  /**
   * Map Inspector: viewport-lite vector enumeration, list/details, optional WMS/ESRI query import.
   * UI is a collapsible `details` block in the Open Maps sidebar (after the active maps list).
   */
  function initOpenMapsInspector(sidebarTab) {
    if (typeof OpenLayers === 'undefined' || !W.map || typeof W.map.getOLMap !== 'function') return;
    var olMap = W.map.getOLMap();
    if (!olMap) return;

    var MAX_ITEMS = 500;
    var MAX_PER_LAYER = 200;
    var MAX_TABLE_COLS = 40;
    var DEBOUNCE_MS = 350;

    var viewportItemsById = new Map();
    var queryItemsById = new Map();
    var viewportListIds = [];
    var queryListIds = [];
    var featureRefById = new Map();
    var selectedId = null;
    /** Per-map: expand (true) or collapse (false) feature rows under that map in the inspector list. Keys are String(mapId). */
    var mapGroupShown = Object.create(null);
    /** Skip full viewport rescan when zoom + quantized view center unchanged (Refresh forces a full run). */
    var lastInspectorViewportBucket = null;
    /** Coalesce ESRI_FEATURE layer.replace → inspector vector ref updates. */
    var inspectorVectorStaleTimer = null;
    var moveTimer = null;
    var mapClickRegistered = false;
    var inspectorMapClickCaptureRegistered = false;
    var highlightSelectLayer = null;
    var highlightSelectHaloLayer = null;
    var highlightSelectLiftLayer = null;
    var highlightHoverLayer = null;
    var highlightHoverHaloLayer = null;
    var highlightHoverLiftLayer = null;
    /** Geometry-only viewport rows (WMS/WFS/query): persistent symbols while inspector is open. */
    var inspectorViewportGeomLayer = null;
    /** Stable inspector item id under the map pointer when not using list hover (see getEffectiveHoverHighlightId). */
    var mapHoverHighlightId = null;
    /** Last list-hover target from row mouseenter / leave (may equal selectedId when between rows). */
    var listHoverHighlightId = null;
    /** Coalesce list hover → map highlight to one OpenLayers update per frame. */
    var inspectorHoverHLRaf = null;
    var inspectorHoverHLPending = null;
    /** Coalesce map pointer moves → ESRI feature hover highlight. */
    var mapEsriHoverRaf = null;
    var mapEsriHoverPendingEvt = null;
    /** Empty string = no ESRI feature under pointer; non-empty = cache key for last hover hit. */
    var mapEsriHoverLastKey = '';
    var truncated = false;
    var viewportGen = 0;
    /** Per viewport scan generation: remote layer request bookkeeping for progress UI. */
    var inspectorRemoteScheduled = Object.create(null);
    var inspectorRemoteCompleted = Object.create(null);
    var inspectorViewportXhrQueue = [];
    var inspectorViewportXhrRunning = 0;
    var INSPECTOR_VIEWPORT_XHR_PARALLEL = 6;
    var INSPECTOR_VIEWPORT_XHR_TIMEOUT_MS = 25000;
    var geometryById = new Map();
    var inspectorCalloutEl = null;
    var inspectorCalloutLonLat = null;

    var inspectorRoot = document.createElement('details');
    inspectorRoot.className = 'openmaps-inspector-details';
    inspectorRoot.style.cssText = 'margin:0; border:0; padding:0; background:transparent;';
    var summary = document.createElement('summary');
    summary.style.cssText = 'font-weight:600; cursor:pointer; padding:0; color:#3c4043; outline:none;';
    summary.textContent = I18n.t('openmaps.inspector_title');
    inspectorRoot.appendChild(summary);

    var card = document.createElement('div');
    card.className = 'openmaps-inspector-panel';
    inspectorRoot.appendChild(card);

    var featuresHd = document.createElement('div');
    featuresHd.className = 'openmaps-inspector-hd';
    featuresHd.textContent = I18n.t('openmaps.inspector_features_grouped');
    card.appendChild(featuresHd);

    function nativeIconBtn(iconClass, tipKey, extraClass) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'openmaps-inspector-ibtn' + (extraClass ? ' ' + extraClass : '');
      b.innerHTML = '<i class="fa ' + iconClass + '" aria-hidden="true"></i>';
      b.setAttribute('aria-label', I18n.t('openmaps.' + tipKey));
      b.title = I18n.t('openmaps.' + tipKey);
      return b;
    }
    var filterRow = document.createElement('div');
    filterRow.className = 'openmaps-inspector-filter-outer';
    var searchWrap = document.createElement('div');
    searchWrap.className = 'openmaps-inspector-search-wrap';
    var searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'openmaps-inspector-filter-min';
    searchInput.placeholder = I18n.t('openmaps.inspector_search_placeholder');
    searchInput.setAttribute('aria-label', I18n.t('openmaps.inspector_search_placeholder'));
    var refreshBtn = nativeIconBtn('fa-refresh', 'inspector_refresh');
    searchWrap.appendChild(searchInput);
    searchWrap.appendChild(refreshBtn);
    filterRow.appendChild(searchWrap);
    card.appendChild(filterRow);

    var listHost = document.createElement('div');
    listHost.className = 'openmaps-inspector-list openmaps-inspector-sep';
    card.appendChild(listHost);
    /** While true, list-driven hover id wins over map-driven hover for dual highlights. */
    var inspectorPointerOverList = false;
    listHost.addEventListener('pointerenter', function() {
      inspectorPointerOverList = true;
      applyInspectorDualHighlights();
    });
    listHost.addEventListener('pointerleave', function(ev) {
      try {
        if (ev.relatedTarget && listHost.contains(ev.relatedTarget)) return;
      } catch (ePE) { /* ignore */ }
      inspectorPointerOverList = false;
      applyInspectorDualHighlights();
    });

    var statusLine = document.createElement('div');
    statusLine.className = 'openmaps-inspector-status';
    card.appendChild(statusLine);

    var queryRow = document.createElement('div');
    queryRow.className = 'openmaps-inspector-query-row openmaps-inspector-sep';
    queryRow.style.cssText = 'display:flex; flex-direction:column; gap:2px;';
    var ingestLabel = document.createElement('label');
    ingestLabel.className = 'openmaps-inspector-ingest-label';
    var ingestCheck = document.createElement('input');
    ingestCheck.type = 'checkbox';
    ingestCheck.checked = Settings.get().inspectorQueryIngest === true;
    ingestCheck.addEventListener('change', function() {
      Settings.set('inspectorQueryIngest', !!ingestCheck.checked);
    });
    ingestLabel.appendChild(ingestCheck);
    ingestLabel.appendChild(document.createTextNode(I18n.t('openmaps.inspector_query_ingest_auto')));
    var autoWmsGfiLabel = document.createElement('label');
    autoWmsGfiLabel.className = 'openmaps-inspector-ingest-label';
    var autoWmsGfiCheck = document.createElement('input');
    autoWmsGfiCheck.type = 'checkbox';
    autoWmsGfiCheck.checked = Settings.get().inspectorAutoWmsGetFeatureInfo !== false;
    autoWmsGfiCheck.addEventListener('change', function() {
      Settings.set('inspectorAutoWmsGetFeatureInfo', !!autoWmsGfiCheck.checked);
      if (isInspectorWinOpen()) {
        lastInspectorViewportBucket = null;
        scheduleViewportRefresh();
      }
    });
    autoWmsGfiLabel.appendChild(autoWmsGfiCheck);
    autoWmsGfiLabel.appendChild(document.createTextNode(I18n.t('openmaps.inspector_auto_wms_gfi')));
    autoWmsGfiLabel.title = I18n.t('openmaps.inspector_auto_wms_gfi_tooltip');
    var clearQueryBtn = nativeIconBtn('fa-trash', 'inspector_clear_query_items');
    clearQueryBtn.style.cssText = 'align-self:flex-start; padding:0;';
    queryRow.appendChild(ingestLabel);
    queryRow.appendChild(autoWmsGfiLabel);
    queryRow.appendChild(clearQueryBtn);
    card.appendChild(queryRow);

    // Floating window wrapper (requested UX): keep a small launcher in the sidebar,
    // but render the inspector itself as a draggable overlay on the map.
    var inspectorLauncher = document.createElement('button');
    inspectorLauncher.type = 'button';
    inspectorLauncher.className = 'openmaps-inspector-launcher-btn';
    inspectorLauncher.innerHTML = '<i class="fa fa-list-alt" aria-hidden="true"></i>';
    inspectorLauncher.title = I18n.t('openmaps.inspector_title');
    inspectorLauncher.setAttribute('aria-label', I18n.t('openmaps.inspector_title'));
    inspectorLauncher.style.cssText = 'width:100%; margin:8px 0 4px 0;';
    sidebarTab.appendChild(inspectorLauncher);

    var win = document.createElement('div');
    win.className = 'openmaps-inspector-window';
    win.style.cssText = 'display:none; position:fixed; z-index:100560; right:18px; top:110px; width:300px; max-width:min(92vw, 380px); max-height:90vh; background:#fff; border:none; border-radius:3px; box-shadow:0 1px 3px rgba(60,64,67,0.12),0 4px 12px rgba(60,64,67,0.12); overflow:hidden; flex-direction:column;';

    var winHead = document.createElement('div');
    winHead.className = 'openmaps-inspector-window-head';
    var winTitle = document.createElement('div');
    winTitle.className = 'openmaps-inspector-window-title';
    winTitle.textContent = I18n.t('openmaps.inspector_title');
    var winBtns = document.createElement('div');
    winBtns.style.cssText = 'display:flex; align-items:center; gap:0;';
    var winMin = nativeIconBtn('fa-toggle-up', 'query_window_minimize', 'openmaps-inspector-ibtn--win');
    var winClose = nativeIconBtn('fa-window-close', 'query_window_close', 'openmaps-inspector-ibtn--win');
    winMin.setAttribute('aria-label', I18n.t('openmaps.query_window_minimize'));
    winMin.title = I18n.t('openmaps.query_window_minimize');
    winClose.setAttribute('aria-label', I18n.t('openmaps.query_window_close'));
    winClose.title = I18n.t('openmaps.query_window_close');
    winBtns.appendChild(winMin);
    winBtns.appendChild(winClose);
    winHead.appendChild(winTitle);
    winHead.appendChild(winBtns);
    win.appendChild(winHead);

    var winBody = document.createElement('div');
    winBody.className = 'openmaps-inspector-window-body';
    winBody.style.cssText = 'padding:0 8px 6px; flex:1 1 auto; min-height:0; overflow:hidden; display:flex; flex-direction:column; background:#fff;';
    win.appendChild(winBody);

    function isInspectorWinOpen() {
      return win && win.style.display !== 'none';
    }

    // Put the actual inspector content into the floating window body.
    inspectorRoot.style.margin = '0';
    inspectorRoot.style.border = '0';
    inspectorRoot.style.borderRadius = '0';
    inspectorRoot.style.padding = '0';
    inspectorRoot.style.background = 'transparent';
    summary.style.display = 'none'; // header already exists in window chrome
    inspectorRoot.open = true; // always open inside window
    winBody.appendChild(inspectorRoot);

    // Attach to Waze map container for sane stacking
    (document.getElementById('WazeMap') || document.body).appendChild(win);

    function getWinState() {
      var s = Settings.get();
      return (s && s.inspectorWindow && typeof s.inspectorWindow === 'object') ? s.inspectorWindow : null;
    }
    function putWinState(patch) {
      var s = Settings.get();
      if (!s.inspectorWindow || typeof s.inspectorWindow !== 'object') s.inspectorWindow = {};
      Object.assign(s.inspectorWindow, patch || {});
      Settings.put(s);
    }
    function applyWinState() {
      var st = getWinState();
      if (!st) return;
      if (typeof st.left === 'number') win.style.left = st.left + 'px';
      if (typeof st.top === 'number') win.style.top = st.top + 'px';
      if (typeof st.width === 'number') win.style.width = Math.max(280, Math.min(520, st.width)) + 'px';
      if (st.minimized === true) {
        winBody.style.display = 'none';
        var ico = winMin.querySelector('i');
        if (ico) { ico.classList.remove('fa-toggle-up'); ico.classList.add('fa-toggle-down'); }
      }
    }
    applyWinState();

    function openWin() {
      win.style.display = 'flex';
      syncMapGroupDefaults();
      scheduleViewportRefresh();
    }
    function closeWin() {
      win.style.display = 'none';
      lastInspectorViewportBucket = null;
      cancelScheduledInspectorHoverHL();
      if (inspectorVectorStaleTimer) {
        clearTimeout(inspectorVectorStaleTimer);
        inspectorVectorStaleTimer = null;
      }
      selectedId = null;
      clearHighlight();
      try {
        if (inspectorViewportGeomLayer && inspectorViewportGeomLayer.removeAllFeatures) inspectorViewportGeomLayer.removeAllFeatures();
      } catch (eVgClose) { /* ignore */ }
      hideInspectorCallout({ clearSelection: true });
    }
    inspectorLauncher.addEventListener('click', function() {
      if (win.style.display === 'none') openWin();
      else closeWin();
    });
    winClose.addEventListener('click', function() { closeWin(); });
    winMin.addEventListener('click', function() {
      var minimized = winBody.style.display !== 'none';
      winBody.style.display = minimized ? 'none' : 'flex';
      var ico = winMin.querySelector('i');
      if (ico) {
        ico.classList.toggle('fa-toggle-up', !minimized);
        ico.classList.toggle('fa-toggle-down', minimized);
      }
      putWinState({ minimized: minimized });
    });

    // Simple draggable header (no dependencies)
    (function enableDrag() {
      var dragging = false;
      var sx = 0, sy = 0, sl = 0, st = 0;
      function onMove(ev) {
        if (!dragging) return;
        var dx = ev.clientX - sx;
        var dy = ev.clientY - sy;
        var nl = sl + dx;
        var nt = st + dy;
        var vw = window.innerWidth, vh = window.innerHeight;
        var r = win.getBoundingClientRect();
        var w = r.width || 320;
        var h = r.height || 240;
        var keep = 40;
        nl = Math.min(vw - keep, Math.max(keep - w, nl));
        nt = Math.min(vh - keep, Math.max(keep - h, nt));
        win.style.left = nl + 'px';
        win.style.top = nt + 'px';
        win.style.right = 'auto';
      }
      function onUp() {
        if (!dragging) return;
        dragging = false;
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('mouseup', onUp, true);
        var rect = win.getBoundingClientRect();
        putWinState({ left: rect.left, top: rect.top, width: rect.width });
      }
      winHead.addEventListener('mousedown', function(ev) {
        // Ignore clicks on buttons
        if (ev.target && ev.target.closest && (ev.target.closest('wz-button') || ev.target.closest('button'))) return;
        dragging = true;
        var rect = win.getBoundingClientRect();
        sx = ev.clientX; sy = ev.clientY;
        sl = rect.left; st = rect.top;
        win.style.left = sl + 'px';
        win.style.top = st + 'px';
        win.style.right = 'auto';
        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup', onUp, true);
      });
    })();

    function isVectorLayer(layer) {
      return !!(layer && layer.CLASS_NAME === 'OpenLayers.Layer.Vector');
    }

    function geomIntersectsExtent(geom, extent) {
      if (!geom || !extent) return false;
      try {
        var b = geom.getBounds();
        return !!(b && extent.intersectsBounds(b));
      } catch (e) {
        return false;
      }
    }

    function labelFromFeature(feature) {
      var attrs = feature.attributes || {};
      var keys = ['name', 'title', 'label', 'NAME', 'Naam', 'naam'];
      for (var i = 0; i < keys.length; i++) {
        var v = attrs[keys[i]];
        if (v != null && String(v).trim() !== '') return String(v).trim();
      }
      if (feature.fid != null) return String(feature.fid);
      if (feature.id != null) return String(feature.id);
      return '—';
    }

    function labelFromAttrs(attrs) {
      if (!attrs || typeof attrs !== 'object') return '—';
      var keys = ['name', 'title', 'label', 'NAME', 'Naam', 'naam'];
      for (var i = 0; i < keys.length; i++) {
        var v = attrs[keys[i]];
        if (v != null && String(v).trim() !== '') return String(v).trim();
      }
      return '—';
    }

    function geoserverOwsBaseFromWmsUrl(u) {
      if (!u || typeof u !== 'string') return null;
      var path = u.split('?')[0].replace(/\/+$/, '');
      if (path.toLowerCase().indexOf('geoserver') === -1) return null;
      var m = path.match(/^(.*\/)wms$/i);
      if (m) return m[1] + 'ows';
      return null;
    }

    function stableFeatureId(mapId, layerKey, feature, idx) {
      var raw = feature.fid != null ? feature.fid : (feature.id != null ? feature.id : '');
      var tail = raw !== '' ? String(raw).replace(/\W/g, '_').slice(0, 80) : ('i' + idx);
      return 'om-inspector-v-' + mapId + '-' + layerKey + '-' + tail;
    }

    function syncMapGroupDefaults() {
      handles.forEach(function(h) {
        var k = String(h.mapId);
        if (typeof mapGroupShown[k] === 'undefined') mapGroupShown[k] = true;
      });
    }

    function inspectorViewportExtentBucket(ext) {
      if (!ext || !olMap) return '';
      var z;
      try {
        z = typeof olMap.getZoom === 'function' ? olMap.getZoom() : (W.map && W.map.getZoom ? W.map.getZoom() : 0);
      } catch (e0) {
        z = 0;
      }
      var cx = (ext.left + ext.right) / 2;
      var cy = (ext.bottom + ext.top) / 2;
      var step = 3500;
      return String(z) + ':' + Math.round(cx / step) + ':' + Math.round(cy / step);
    }

    function inspectorHandleForMapId(mapIdStr) {
      for (var ih = 0; ih < handles.length; ih++) {
        if (String(handles[ih].mapId) === String(mapIdStr)) return handles[ih];
      }
      return null;
    }

    function inspectorMapGroupExpanded(mid) {
      return mapGroupShown[mid] !== false;
    }

    function syncInspectorCalloutPanelWidth() {
      if (!inspectorCalloutEl || !inspectorCalloutEl._panel) return;
      try {
        var r = win.getBoundingClientRect();
        if (r.width) inspectorCalloutEl._panel.style.width = Math.round(r.width * 1.1) + 'px';
      } catch (eW) {}
    }

    function kindLabelForItem(it) {
      var k = it.kind;
      if (k === 'query') return I18n.t('openmaps.inspector_kind_query');
      if (k === 'esri') return I18n.t('openmaps.inspector_kind_esri');
      if (k === 'wms') return I18n.t('openmaps.inspector_kind_wms');
      if (k === 'wfs') return I18n.t('openmaps.inspector_kind_wfs');
      return I18n.t('openmaps.inspector_kind_vector');
    }

    function mapTitleForInspector(mapId) {
      var m = maps.get(mapId);
      if (!m && mapId != null && mapId !== '') {
        var n = Number(mapId);
        if (!isNaN(n)) m = maps.get(n);
      }
      if (!m && mapId != null) m = maps.get(String(mapId));
      return m && m.title ? m.title : String(mapId);
    }

    function inspectorRemoteNoteComplete(gen) {
      inspectorRemoteCompleted[gen] = (inspectorRemoteCompleted[gen] || 0) + 1;
      if (gen === viewportGen) paintInspectorStatusLine();
    }

    function pumpInspectorViewportXhrQueue() {
      while (inspectorViewportXhrRunning < INSPECTOR_VIEWPORT_XHR_PARALLEL && inspectorViewportXhrQueue.length > 0) {
        var job = inspectorViewportXhrQueue.shift();
        var gen = job.gen;
        var opts;
        try {
          opts = job.makeOpts();
        } catch (e) {
          inspectorRemoteNoteComplete(gen);
          continue;
        }
        if (!opts || !opts.url) {
          inspectorRemoteNoteComplete(gen);
          continue;
        }
        inspectorViewportXhrRunning++;
        var timeoutMs = opts.timeout != null ? opts.timeout : INSPECTOR_VIEWPORT_XHR_TIMEOUT_MS;
        var oload = opts.onload;
        var oerr = opts.onerror;
        var oto = opts.ontimeout;
        function finishOne() {
          if (inspectorViewportXhrRunning > 0) inspectorViewportXhrRunning--;
          inspectorRemoteNoteComplete(gen);
          pumpInspectorViewportXhrQueue();
        }
        try {
          GM_xmlhttpRequest({
            method: opts.method || 'GET',
            url: opts.url,
            timeout: timeoutMs,
            headers: opts.headers,
            onload: function(res) {
              try { if (oload) oload(res); } catch (e1) {}
              finishOne();
            },
            onerror: function() {
              try { if (oerr) oerr(); } catch (e2) {}
              finishOne();
            },
            ontimeout: function() {
              try { if (oto) oto(); } catch (e3) {}
              finishOne();
            }
          });
        } catch (e4) {
          if (inspectorViewportXhrRunning > 0) inspectorViewportXhrRunning--;
          inspectorRemoteNoteComplete(gen);
          pumpInspectorViewportXhrQueue();
        }
      }
    }

    function enqueueInspectorViewportXhr(gen, makeOpts) {
      inspectorRemoteScheduled[gen] = (inspectorRemoteScheduled[gen] || 0) + 1;
      inspectorViewportXhrQueue.push({ gen: gen, makeOpts: makeOpts });
      pumpInspectorViewportXhrQueue();
    }

    /**
     * Drop stale OpenLayers feature pointers for sidebar “vector” rows and rebuild from current layer contents.
     * ESRI_FEATURE (and other vectors) replace features on pan; same viewport bucket skipped a full run but refs must refresh.
     */
    function refreshInspectorInMemoryVectorRefs() {
      if (!isInspectorWinOpen()) return;
      var extent = typeof getMapExtent === 'function' ? getMapExtent() : null;
      if (!extent) return;
      var toRemove = [];
      viewportItemsById.forEach(function(it, id) {
        if (String(id).indexOf('om-inspector-v-') === 0) toRemove.push(id);
      });
      for (var rmi = 0; rmi < toRemove.length; rmi++) {
        var rid = toRemove[rmi];
        viewportItemsById.delete(rid);
        featureRefById.delete(rid);
        geometryById.delete(rid);
      }
      viewportListIds = viewportListIds.filter(function(lid) {
        return toRemove.indexOf(lid) < 0;
      });
      var total = viewportItemsById.size;
      for (var hi = 0; hi < handles.length && total < MAX_ITEMS; hi++) {
        var handle = handles[hi];
        var mapId = handle.mapId;
        var meta = maps.get(mapId);
        var mapTitle = meta ? meta.title : String(mapId);

        function consumeLayerRefresh(olLayer, layerKey, labelSuffix) {
          if (!olLayer || !isVectorLayer(olLayer)) return;
          if (!olLayer.getVisibility()) return;
          var feats = olLayer.features || [];
          var added = 0;
          for (var fi = 0; fi < feats.length && total < MAX_ITEMS && added < MAX_PER_LAYER; fi++) {
            var feat = feats[fi];
            if (!feat || !feat.geometry) continue;
            if (!geomIntersectsExtent(feat.geometry, extent)) continue;
            var id = stableFeatureId(mapId, layerKey, feat, fi);
            if (viewportItemsById.has(id)) continue;
            var props = {};
            try {
              var a = feat.attributes || {};
              Object.keys(a).forEach(function(k) {
                props[k] = a[k];
              });
            } catch (e1) {}
            var item = {
              id: id,
              label: labelFromFeature(feat),
              source: mapTitle + ' · ' + labelSuffix,
              kind: 'vector',
              mapId: mapId,
              props: props,
              bbox: null
            };
            try {
              var gb = feat.geometry.getBounds();
              if (gb) item.bbox = { left: gb.left, bottom: gb.bottom, right: gb.right, top: gb.top };
            } catch (e2) {}
            viewportItemsById.set(id, item);
            featureRefById.set(id, { feature: feat, layer: olLayer });
            viewportListIds.push(id);
            total++;
            added++;
          }
        }

        consumeLayerRefresh(handle.bboxLayer, 'bbox', I18n.t('openmaps.inspector_bbox_layer'));
        consumeLayerRefresh(handle.layer && isVectorLayer(handle.layer) ? handle.layer : null, 'main', I18n.t('openmaps.map_layers_title'));
      }
      if (total >= MAX_ITEMS) truncated = true;
    }

    function runViewportIndex(forceFull) {
      if (!isInspectorWinOpen()) return;
      var extentEarly = typeof getMapExtent === 'function' ? getMapExtent() : null;
      if (extentEarly) {
        var bucketEarly = inspectorViewportExtentBucket(extentEarly);
        if (!forceFull && bucketEarly === lastInspectorViewportBucket) {
          refreshInspectorInMemoryVectorRefs();
          renderFullList();
          paintInspectorStatusLine();
          return;
        }
        lastInspectorViewportBucket = bucketEarly;
      } else {
        lastInspectorViewportBucket = null;
      }

      var myGen = ++viewportGen;
      var qdj;
      for (qdj = 0; qdj < inspectorViewportXhrQueue.length; qdj++) {
        inspectorRemoteNoteComplete(inspectorViewportXhrQueue[qdj].gen);
      }
      inspectorViewportXhrQueue.length = 0;
      inspectorRemoteScheduled[myGen] = 0;
      inspectorRemoteCompleted[myGen] = 0;
      viewportItemsById.clear();
      featureRefById.clear();
      geometryById.clear();
      viewportListIds = [];
      truncated = false;
      var extent = extentEarly;
      if (!extent) {
        renderFullList();
        return;
      }
      var total = 0;
      for (var hi = 0; hi < handles.length && total < MAX_ITEMS; hi++) {
        var handle = handles[hi];
        var mapId = handle.mapId;
        var meta = maps.get(mapId);
        var mapTitle = meta ? meta.title : String(mapId);

        function consumeLayer(olLayer, layerKey, labelSuffix) {
          if (!olLayer || !isVectorLayer(olLayer)) return;
          if (!olLayer.getVisibility()) return;
          var feats = olLayer.features || [];
          var added = 0;
          for (var fi = 0; fi < feats.length && total < MAX_ITEMS && added < MAX_PER_LAYER; fi++) {
            var feat = feats[fi];
            if (!feat || !feat.geometry) continue;
            if (!geomIntersectsExtent(feat.geometry, extent)) continue;
            var id = stableFeatureId(mapId, layerKey, feat, fi);
            if (viewportItemsById.has(id)) continue;
            var props = {};
            try {
              var a = feat.attributes || {};
              Object.keys(a).forEach(function(k) {
                props[k] = a[k];
              });
            } catch (e1) {}
            var item = {
              id: id,
              label: labelFromFeature(feat),
              source: mapTitle + ' · ' + labelSuffix,
              kind: 'vector',
              mapId: mapId,
              props: props,
              bbox: null
            };
            try {
              var gb = feat.geometry.getBounds();
              if (gb) item.bbox = { left: gb.left, bottom: gb.bottom, right: gb.right, top: gb.top };
            } catch (e2) {}
            viewportItemsById.set(id, item);
            featureRefById.set(id, { feature: feat, layer: olLayer });
            viewportListIds.push(id);
            total++;
            added++;
          }
        }

        consumeLayer(handle.bboxLayer, 'bbox', I18n.t('openmaps.inspector_bbox_layer'));
        consumeLayer(handle.layer && isVectorLayer(handle.layer) ? handle.layer : null, 'main', I18n.t('openmaps.map_layers_title'));
      }
      if (total >= MAX_ITEMS) truncated = true;

      function mergeArcgisRestLayerFeatures(json, mapId, layerId, layerTitle, mapTitle, itemKind, idPrefix) {
        if (myGen !== viewportGen) return;
        if (!json || json.error) return;
        var feats = json.features;
        if (!Array.isArray(feats)) return;
        feats.forEach(function(f, idx) {
          if (viewportListIds.length >= MAX_ITEMS) {
            truncated = true;
            return;
          }
          var attrs = f.attributes || {};
          var oid = attrs.OBJECTID != null ? attrs.OBJECTID : (attrs.FID != null ? attrs.FID : (attrs.objectid != null ? attrs.objectid : idx));
          var id = idPrefix + mapId + '-' + layerId + '-' + String(oid).replace(/\W/g, '_');
          if (viewportItemsById.has(id)) return;
          var props = {};
          Object.keys(attrs).forEach(function(k) { props[k] = attrs[k]; });
          var label = labelFromAttrs(props);
          var geom = openMapsEsriGeometryToOpenLayers(f.geometry);
          var item = {
            id: id,
            label: label,
            source: mapTitle + ' · ' + layerTitle,
            kind: itemKind,
            mapId: mapId,
            props: props,
            bbox: null
          };
          if (geom) {
            try {
              var gb = geom.getBounds();
              if (gb) item.bbox = { left: gb.left, bottom: gb.bottom, right: gb.right, top: gb.top };
            } catch (e0) {}
          }
          viewportItemsById.set(id, item);
          if (geom) geometryById.set(id, geom);
          viewportListIds.push(id);
        });
        renderFullList();
      }

      function mergeGeoJsonWfsFeatures(geojson, mapId, layerName, layerTitle, mapTitle) {
        if (myGen !== viewportGen) return;
        if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) return;
        var fmt = new OpenLayers.Format.GeoJSON({
          externalProjection: olMap.getProjectionObject(),
          internalProjection: olMap.getProjectionObject()
        });
        var parsed;
        try {
          parsed = fmt.read(JSON.stringify(geojson));
        } catch (e1) {
          return;
        }
        if (!parsed) return;
        var arr = Array.isArray(parsed) ? parsed : [parsed];
        arr.forEach(function(olf, idx) {
          if (viewportListIds.length >= MAX_ITEMS) {
            truncated = true;
            return;
          }
          if (!olf || !olf.geometry) return;
          var attrs = olf.attributes || olf.data || {};
          var fid = attrs.id != null ? attrs.id : (attrs.gml_id != null ? attrs.gml_id : idx);
          var id = 'om-inspector-wfs-' + mapId + '-' + String(layerName).replace(/\W/g, '_').slice(0, 48) + '-' + String(fid).replace(/\W/g, '_').slice(0, 48) + '-' + idx;
          if (viewportItemsById.has(id)) return;
          var props = {};
          Object.keys(attrs).forEach(function(k) { props[k] = attrs[k]; });
          var label = labelFromAttrs(props);
          var geom = olf.geometry;
          var item = {
            id: id,
            label: label,
            source: mapTitle + ' · ' + layerTitle,
            kind: 'wfs',
            mapId: mapId,
            props: props,
            bbox: null
          };
          if (geom) {
            try {
              var gb = geom.getBounds();
              if (gb) item.bbox = { left: gb.left, bottom: gb.bottom, right: gb.right, top: gb.top };
            } catch (e2) {}
          }
          viewportItemsById.set(id, item);
          if (geom) geometryById.set(id, geom.clone ? geom.clone() : geom);
          viewportListIds.push(id);
        });
        renderFullList();
      }

      var bboxStr = extent.left + ',' + extent.bottom + ',' + extent.right + ',' + extent.top;
      var maxPer = Math.min(MAX_PER_LAYER, 200);
      for (var hi2 = 0; hi2 < handles.length; hi2++) {
        var h = handles[hi2];
        var m = maps.get(h.mapId);
        if (!m || m.type !== 'ESRI') continue;
        if (!h.layer || !h.layer.getVisibility()) continue;
        if (!h.mapLayers || !h.mapLayers.length) continue;
        var baseUrl = (m.url || '').replace(/\/+$/, '');
        if (!baseUrl) continue;
        var mapTitle2 = m.title || String(h.mapId);
        for (var mi = 0; mi < h.mapLayers.length; mi++) {
          var ml = h.mapLayers[mi];
          var lid = parseInt(ml.name, 10);
          if (isNaN(lid)) continue;
          if (!ml.visible) continue;
          var layerTitle = (m.layers && m.layers[ml.name] && m.layers[ml.name].title) ? m.layers[ml.name].title : ('#' + ml.name);
          var qUrl = baseUrl + '/' + lid + '/query?f=json&where=' + encodeURIComponent('1=1') +
            '&returnGeometry=true&outFields=*&geometry=' + encodeURIComponent(bboxStr) +
            '&geometryType=esriGeometryEnvelope&inSR=3857&outSR=3857&spatialRel=esriSpatialRelIntersects' +
            '&resultRecordCount=' + maxPer;
          (function(mid, lid2, lt, mt, qUrl_) {
            enqueueInspectorViewportXhr(myGen, function() {
              return {
                method: 'GET',
                url: qUrl_,
                timeout: INSPECTOR_VIEWPORT_XHR_TIMEOUT_MS,
                onload: function(res) {
                  try {
                    if (myGen !== viewportGen) return;
                    if (res.status !== 200) return;
                    try {
                      var json = JSON.parse(res.responseText || '{}');
                      mergeArcgisRestLayerFeatures(json, mid, lid2, lt, mt, 'esri', 'om-inspector-esri-');
                    } catch (e) {}
                  } catch (e) {}
                },
                onerror: function() {},
                ontimeout: function() {}
              };
            });
          })(h.mapId, lid, layerTitle, mapTitle2, qUrl);
        }
      }

      for (var hiW = 0; hiW < handles.length; hiW++) {
        var hw = handles[hiW];
        var mw = maps.get(hw.mapId);
        if (!mw || mw.type !== 'WMS') continue;
        var restBase = openMapsArcgisRestBaseFromWmsUrl(mw.url || '');
        if (!restBase) continue;
        if (hw.wmsArcgisRestViewportProbe === false) continue;
        if (hw.hidden || hw.outOfArea || !isTouAccepted(mw.touId)) continue;
        if (!hw.mapLayers || !hw.mapLayers.length) continue;
        var mapTitleW = mw.title || String(hw.mapId);
        for (var miw = 0; miw < hw.mapLayers.length; miw++) {
          var mlw = hw.mapLayers[miw];
          var lidw = parseInt(mlw.name, 10);
          if (isNaN(lidw)) continue;
          if (!mlw.visible) continue;
          var layerTitleW = (mw.layers && mw.layers[mlw.name] && mw.layers[mlw.name].title) ? mw.layers[mlw.name].title : ('#' + mlw.name);
          var qUrlW = restBase + '/' + lidw + '/query?f=json&where=' + encodeURIComponent('1=1') +
            '&returnGeometry=true&outFields=*&geometry=' + encodeURIComponent(bboxStr) +
            '&geometryType=esriGeometryEnvelope&inSR=3857&outSR=3857&spatialRel=esriSpatialRelIntersects' +
            '&resultRecordCount=' + maxPer;
          (function(mid, lid2, lt, mt, qUrlW_) {
            enqueueInspectorViewportXhr(myGen, function() {
              return {
                method: 'GET',
                url: qUrlW_,
                timeout: INSPECTOR_VIEWPORT_XHR_TIMEOUT_MS,
                onload: function(res) {
                  try {
                    if (myGen !== viewportGen) return;
                    if (res.status !== 200) return;
                    try {
                      var json = JSON.parse(res.responseText || '{}');
                      mergeArcgisRestLayerFeatures(json, mid, lid2, lt, mt, 'wms', 'om-inspector-wmsa-');
                    } catch (e) {}
                  } catch (e) {}
                },
                onerror: function() {},
                ontimeout: function() {}
              };
            });
          })(hw.mapId, lidw, layerTitleW, mapTitleW, qUrlW);
        }
      }

      for (var hiF = 0; hiF < handles.length; hiF++) {
        var hf = handles[hiF];
        var mf = maps.get(hf.mapId);
        if (!mf || mf.type !== 'WMS') continue;
        var owsBase = geoserverOwsBaseFromWmsUrl(mf.url || '');
        if (!owsBase) continue;
        if (!hf.layer || !hf.layer.getVisibility()) continue;
        if (!hf.mapLayers || !hf.mapLayers.length) continue;
        var mapTitleF = mf.title || String(hf.mapId);
        for (var mif = 0; mif < hf.mapLayers.length; mif++) {
          var mlf = hf.mapLayers[mif];
          if (!mlf.visible) continue;
          var layerTitleF = (mf.layers && mf.layers[mlf.name] && mf.layers[mlf.name].title) ? mf.layers[mlf.name].title : mlf.name;
          var bboxWfs = bboxStr + ',urn:ogc:def:crs:EPSG::3857';
          var wfsUrl = owsBase + '?service=WFS&version=2.0.0&request=GetFeature&typeNames=' + encodeURIComponent(mlf.name) +
            '&count=' + maxPer + '&outputFormat=application/json&srsName=EPSG:3857&bbox=' + encodeURIComponent(bboxWfs);
          (function(mid, lname, lt, mt, wfsUrl_) {
            enqueueInspectorViewportXhr(myGen, function() {
              return {
                method: 'GET',
                url: wfsUrl_,
                timeout: INSPECTOR_VIEWPORT_XHR_TIMEOUT_MS,
                onload: function(res) {
                  try {
                    if (myGen !== viewportGen) return;
                    if (res.status !== 200) return;
                    try {
                      var gj = JSON.parse(res.responseText || '{}');
                      mergeGeoJsonWfsFeatures(gj, mid, lname, lt, mt);
                    } catch (e) {}
                  } catch (e) {}
                },
                onerror: function() {},
                ontimeout: function() {}
              };
            });
          })(hf.mapId, mlf.name, layerTitleF, mapTitleF, wfsUrl);
        }
      }

      renderFullList();
    }

    function getCombinedOrderedIds() {
      var seen = Object.create(null);
      var out = [];
      viewportListIds.forEach(function(id) {
        if (!seen[id]) { seen[id] = true; out.push(id); }
      });
      queryListIds.forEach(function(id) {
        if (!seen[id] && queryItemsById.has(id)) { seen[id] = true; out.push(id); }
      });
      if (out.length > MAX_ITEMS) truncated = true;
      return out.slice(0, MAX_ITEMS);
    }

    function getDisplayItems(ids) {
      var q = (searchInput.value || '').trim().toLowerCase();
      if (!q) return ids;
      return ids.filter(function(id) {
        var it = viewportItemsById.get(id) || queryItemsById.get(id);
        if (!it) return false;
        var blob = (it.label + ' ' + it.source + ' ' + JSON.stringify(it.props || {})).toLowerCase();
        return blob.indexOf(q) !== -1;
      });
    }

    function paintInspectorStatusLine() {
      var ids = getCombinedOrderedIds();
      var display = getDisplayItems(ids);
      var countText = (truncated ? I18n.t('openmaps.inspector_list_truncated') + ' ' : '') +
        '(' + display.length + '/' + Math.min(ids.length, MAX_ITEMS) + ')';
      var g = viewportGen;
      var sched = inspectorRemoteScheduled[g] || 0;
      var done = inspectorRemoteCompleted[g] || 0;
      var showScan = sched > 0 && done < sched;
      statusLine.innerHTML = '';
      statusLine.className = 'openmaps-inspector-status' + (display.length ? ' openmaps-inspector-status--has' : '');
      if (showScan) statusLine.classList.add('openmaps-inspector-status--busy');
      var countSpan = document.createElement('span');
      countSpan.className = 'openmaps-inspector-status-count';
      countSpan.textContent = countText;
      statusLine.appendChild(countSpan);
      if (showScan) {
        statusLine.appendChild(document.createTextNode(' '));
        var scan = document.createElement('span');
        scan.className = 'openmaps-inspector-status-scan';
        scan.setAttribute('role', 'status');
        var prog = I18n.t('openmaps.inspector_scan_progress')
          .replace(/\{done\}/g, String(done))
          .replace(/\{total\}/g, String(sched));
        scan.setAttribute('aria-label', prog);
        var ic = document.createElement('i');
        ic.className = 'fa fa-spinner fa-spin';
        ic.setAttribute('aria-hidden', 'true');
        scan.appendChild(ic);
        scan.appendChild(document.createTextNode(' ' + prog));
        statusLine.appendChild(scan);
      }
      statusLine.setAttribute('aria-busy', showScan ? 'true' : 'false');
      listHost.setAttribute('aria-busy', showScan ? 'true' : 'false');
      var rico = refreshBtn.querySelector('i');
      if (rico) {
        if (showScan) rico.classList.add('fa-spin');
        else rico.classList.remove('fa-spin');
      }
      refreshBtn.setAttribute('aria-busy', showScan ? 'true' : 'false');
    }

    function renderFullList() {
      listHost.innerHTML = '';
      syncMapGroupDefaults();
      paintInspectorStatusLine();
      var ids = getCombinedOrderedIds();
      var display = getDisplayItems(ids);
      if (!display.length) {
        var empty = document.createElement('div');
        empty.className = 'openmaps-inspector-empty';
        empty.textContent = I18n.t('openmaps.inspector_list_empty') + ' ' +
          (Settings.get().inspectorAutoWmsGetFeatureInfo !== false
            ? I18n.t('openmaps.inspector_list_empty_hint_auto')
            : I18n.t('openmaps.inspector_list_empty_hint_manual'));
        listHost.appendChild(empty);
        applyInspectorDualHighlights();
        return;
      }
      var mapOrder = [];
      var byMap = Object.create(null);
      display.forEach(function(id) {
        var it = viewportItemsById.get(id) || queryItemsById.get(id);
        if (!it) return;
        var mid = String(it.mapId);
        if (!byMap[mid]) {
          byMap[mid] = [];
          mapOrder.push(mid);
        }
        byMap[mid].push(id);
      });
      mapOrder.forEach(function(mid) {
        var groupIds = byMap[mid];
        var mapTitle = mapTitleForInspector(mid);
        var groupWrap = document.createElement('div');
        groupWrap.className = 'openmaps-inspector-map-group';

        var headRow = document.createElement('div');
        headRow.className = 'openmaps-inspector-map-head';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = inspectorMapGroupExpanded(mid);
        cb.setAttribute('aria-label', I18n.t('openmaps.inspector_map_group_toggle'));
        cb.title = I18n.t('openmaps.inspector_map_group_toggle');
        cb.addEventListener('change', function() {
          mapGroupShown[mid] = !!cb.checked;
          renderFullList();
        });
        cb.addEventListener('click', function(ev) { ev.stopPropagation(); });
        var titleSpan = document.createElement('span');
        titleSpan.className = 'openmaps-inspector-map-head-title';
        titleSpan.textContent = mapTitle;
        var countSpan = document.createElement('span');
        countSpan.className = 'openmaps-inspector-map-head-count';
        countSpan.textContent = '(' + groupIds.length + ')';
        var menuDetails = document.createElement('details');
        menuDetails.className = 'openmaps-inspector-map-menu-details';
        var menuSum = document.createElement('summary');
        menuSum.className = 'openmaps-inspector-ibtn openmaps-inspector-map-menu-summary';
        menuSum.innerHTML = '<i class="fa fa-ellipsis-v" aria-hidden="true"></i>';
        menuSum.setAttribute('aria-label', I18n.t('openmaps.inspector_map_row_menu'));
        menuSum.title = I18n.t('openmaps.inspector_map_row_menu');
        menuSum.addEventListener('click', function(ev) { ev.stopPropagation(); });
        var menuPanel = document.createElement('div');
        menuPanel.className = 'openmaps-inspector-map-menu-panel';
        var openTableBtn = document.createElement('button');
        openTableBtn.type = 'button';
        openTableBtn.className = 'openmaps-inspector-map-menu-item';
        openTableBtn.textContent = I18n.t('openmaps.inspector_open_data_table');
        openTableBtn.addEventListener('click', function(ev) {
          ev.preventDefault();
          ev.stopPropagation();
          menuDetails.open = false;
          openDataTableForMap(mid);
        });
        menuPanel.appendChild(openTableBtn);
        menuDetails.appendChild(menuSum);
        menuDetails.appendChild(menuPanel);
        menuDetails.addEventListener('toggle', function() {
          if (menuDetails.open) {
            var allD = listHost.querySelectorAll('.openmaps-inspector-map-menu-details');
            for (var di = 0; di < allD.length; di++) {
              if (allD[di] !== menuDetails) allD[di].open = false;
            }
          }
        });
        headRow.appendChild(cb);
        headRow.appendChild(titleSpan);
        headRow.appendChild(countSpan);
        headRow.appendChild(menuDetails);
        groupWrap.appendChild(headRow);

        if (inspectorMapGroupExpanded(mid)) {
          var avColor = openMapsMapAvatarColorFromTitle(mapTitle);
          var effListHoverId = getEffectiveHoverHighlightId();
          groupIds.forEach(function(id) {
            var it = viewportItemsById.get(id) || queryItemsById.get(id);
            if (!it) return;
            var row = document.createElement('div');
            var rowCls = 'openmaps-inspector-list-row';
            if (id === selectedId) rowCls += ' openmaps-inspector-list-row--sel';
            if (effListHoverId && id === effListHoverId) rowCls += ' openmaps-inspector-list-row--hov';
            row.className = rowCls;
            row.dataset.itemId = id;
            var av = document.createElement('div');
            av.className = 'openmaps-inspector-avatar';
            av.style.backgroundColor = avColor;
            av.setAttribute('aria-hidden', 'true');
            var left = document.createElement('div');
            left.className = 'openmaps-inspector-row-main';
            var titleEl = document.createElement('div');
            titleEl.className = 'openmaps-inspector-row-title';
            titleEl.textContent = it.label || id;
            var srcEl = document.createElement('div');
            srcEl.className = 'openmaps-inspector-row-sub';
            srcEl.textContent = (it.source ? it.source + ' · ' : '') + kindLabelForItem(it);
            left.appendChild(titleEl);
            left.appendChild(srcEl);
            row.appendChild(av);
            row.appendChild(left);
            row.addEventListener('click', function() {
              selectItem(id);
            });
            row.addEventListener('mouseenter', function() {
              scheduleInspectorListHoverHighlight(id);
            });
            row.addEventListener('mouseleave', function(ev) {
              var rel = ev.relatedTarget;
              if (rel && rel.nodeType === 1 && listHost.contains(rel)) {
                try {
                  if (typeof rel.closest === 'function' && rel.closest('.openmaps-inspector-list-row')) return;
                } catch (e) {}
              }
              scheduleInspectorListHoverHighlight(selectedId);
            });
            groupWrap.appendChild(row);
          });
        }
        listHost.appendChild(groupWrap);
      });
      applyInspectorDualHighlights();
    }

    function formatInspectorItemDetails(it) {
      var lines = [];
      lines.push(it.label);
      lines.push('');
      try {
        var keys = Object.keys(it.props || {}).sort();
        keys.forEach(function(k) {
          lines.push(k + ': ' + JSON.stringify(it.props[k]));
        });
      } catch (e) {
        lines.push(String(it.props));
      }
      return lines.join('\n');
    }

    function getInspectorItemAnchorLonLat(id, it) {
      try {
        var ref = featureRefById.get(id);
        if (ref && ref.feature && ref.feature.geometry) {
          var gb = ref.feature.geometry.getBounds();
          if (gb && gb.getCenterLonLat) return gb.getCenterLonLat();
        }
        var geom = geometryById.get(id);
        if (geom && geom.getBounds) {
          var b = geom.getBounds();
          if (b && b.getCenterLonLat) return b.getCenterLonLat();
        }
        if (it && it.bbox) {
          var bb = it.bbox;
          return new OpenLayers.Bounds(bb.left, bb.bottom, bb.right, bb.top).getCenterLonLat();
        }
      } catch (e) {}
      return null;
    }

    function positionInspectorCallout() {
      if (!inspectorCalloutEl || inspectorCalloutEl.style.display === 'none' || !inspectorCalloutLonLat) return;
      syncInspectorCalloutPanelWidth();
      try {
        var px = olMap.getPixelFromLonLat(inspectorCalloutLonLat);
        if (!px) return;
        inspectorCalloutEl.style.left = Math.round(px.x) + 'px';
        inspectorCalloutEl.style.top = Math.round(px.y) + 'px';
      } catch (e) {}
    }

    function detachInspectorCalloutMapPanGuard() {
      if (!inspectorCalloutEl || !inspectorCalloutEl._onMapMoveArm || !olMap || !olMap.events) return;
      try {
        olMap.events.unregister('move', null, inspectorCalloutEl._onMapMoveArm);
      } catch (eM) { /* ignore */ }
      inspectorCalloutEl._onMapMoveArm = null;
    }

    function hideInspectorCallout(opt) {
      if (!inspectorCalloutEl) return;
      var wasVisible = inspectorCalloutEl.style.display !== 'none';
      inspectorCalloutEl.style.display = 'none';
      inspectorCalloutLonLat = null;
      if (inspectorCalloutEl._onMove) {
        try {
          olMap.events.unregister('move', null, inspectorCalloutEl._onMove);
          olMap.events.unregister('moveend', null, inspectorCalloutEl._onMove);
        } catch (e) {}
        inspectorCalloutEl._onMove = null;
      }
      if (inspectorCalloutEl._onDocMove) {
        document.removeEventListener('pointermove', inspectorCalloutEl._onDocMove, true);
        inspectorCalloutEl._onDocMove = null;
      }
      if (inspectorCalloutEl._onDocUp) {
        document.removeEventListener('pointerup', inspectorCalloutEl._onDocUp, true);
        document.removeEventListener('pointercancel', inspectorCalloutEl._onDocUp, true);
        inspectorCalloutEl._onDocUp = null;
      }
      if (inspectorCalloutEl._onDoc) {
        document.removeEventListener('pointerdown', inspectorCalloutEl._onDoc, true);
        inspectorCalloutEl._onDoc = null;
      }
      detachInspectorCalloutMapPanGuard();
      inspectorCalloutEl._calloutDismissArm = null;
      if (wasVisible && opt && opt.clearSelection === true) {
        selectedId = null;
        try {
          renderFullList();
        } catch (eRF) {
          applyInspectorDualHighlights();
        }
      }
    }

    function ensureInspectorCallout() {
      if (inspectorCalloutEl) return inspectorCalloutEl;
      try {
        olMap.div.style.position = olMap.div.style.position || 'relative';
      } catch (e) {}
      var outer = document.createElement('div');
      outer.className = 'openmaps-inspector-callout';
      outer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:100500;display:none;pointer-events:none;';
      var panel = document.createElement('div');
      panel.className = 'openmaps-inspector-callout-panel';
      var head = document.createElement('div');
      head.className = 'openmaps-inspector-callout-head';
      var titleEl = document.createElement('div');
      titleEl.className = 'openmaps-inspector-callout-title';
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'openmaps-inspector-callout-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.setAttribute('aria-label', I18n.t('openmaps.inspector_table_close'));
      head.appendChild(titleEl);
      head.appendChild(closeBtn);
      var bodyPre = document.createElement('pre');
      bodyPre.className = 'openmaps-inspector-callout-body';
      panel.appendChild(head);
      panel.appendChild(bodyPre);
      outer.appendChild(panel);
      olMap.div.appendChild(outer);
      inspectorCalloutEl = outer;
      inspectorCalloutEl._panel = panel;
      inspectorCalloutEl._title = titleEl;
      inspectorCalloutEl._body = bodyPre;
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        hideInspectorCallout({ clearSelection: true });
      });
      panel.addEventListener('pointerdown', function(e) { e.stopPropagation(); });
      return inspectorCalloutEl;
    }

    function showInspectorCalloutForItem(id, it) {
      var ll = getInspectorItemAnchorLonLat(id, it);
      if (!ll) {
        hideInspectorCallout();
        return;
      }
      var el = ensureInspectorCallout();
      inspectorCalloutLonLat = ll;
      el._title.textContent = it.label || id;
      el._body.textContent = formatInspectorItemDetails(it);
      el.style.display = 'block';
      positionInspectorCallout();
      function onMove() {
        positionInspectorCallout();
      }
      if (el._onMove) {
        try {
          olMap.events.unregister('move', null, el._onMove);
          olMap.events.unregister('moveend', null, el._onMove);
        } catch (e) {}
      }
      el._onMove = onMove;
      try {
        olMap.events.register('move', null, onMove);
        olMap.events.register('moveend', null, onMove);
      } catch (e) {}
      if (el._onDocMove) {
        document.removeEventListener('pointermove', el._onDocMove, true);
        el._onDocMove = null;
      }
      if (el._onDocUp) {
        document.removeEventListener('pointerup', el._onDocUp, true);
        document.removeEventListener('pointercancel', el._onDocUp, true);
        el._onDocUp = null;
      }
      if (el._onDoc) {
        document.removeEventListener('pointerdown', el._onDoc, true);
        el._onDoc = null;
      }
      detachInspectorCalloutMapPanGuard();
      el._calloutDismissArm = null;
      setTimeout(function() {
        var dragTolPx = 8;
        var dragTol2 = dragTolPx * dragTolPx;
        function removeGestureListeners() {
          if (!inspectorCalloutEl) return;
          if (inspectorCalloutEl._onDocMove) {
            document.removeEventListener('pointermove', inspectorCalloutEl._onDocMove, true);
            inspectorCalloutEl._onDocMove = null;
          }
          if (inspectorCalloutEl._onDocUp) {
            document.removeEventListener('pointerup', inspectorCalloutEl._onDocUp, true);
            document.removeEventListener('pointercancel', inspectorCalloutEl._onDocUp, true);
            inspectorCalloutEl._onDocUp = null;
          }
          detachInspectorCalloutMapPanGuard();
          inspectorCalloutEl._calloutDismissArm = null;
        }
        function onDocPointerMove(ev) {
          var arm = inspectorCalloutEl && inspectorCalloutEl._calloutDismissArm;
          if (!arm || ev.pointerId !== arm.pid) return;
          var dx = ev.clientX - arm.x0;
          var dy = ev.clientY - arm.y0;
          if (dx * dx + dy * dy > dragTol2) arm.dragged = true;
        }
        function onDocPointerUp(ev) {
          if (!inspectorCalloutEl || inspectorCalloutEl.style.display === 'none') {
            removeGestureListeners();
            return;
          }
          var arm = inspectorCalloutEl._calloutDismissArm;
          if (!arm || ev.pointerId !== arm.pid) return;
          var cancelled = ev.type === 'pointercancel';
          var dx = ev.clientX - arm.x0;
          var dy = ev.clientY - arm.y0;
          var dragged = cancelled || arm.dragged || (dx * dx + dy * dy > dragTol2);
          removeGestureListeners();
          if (dragged) return;
          if (inspectorCalloutEl.contains(ev.target)) return;
          if (ev.target.closest && (ev.target.closest('#sidepanel-openMaps') || ev.target.closest('.openmaps-inspector-window'))) return;
          hideInspectorCallout({ clearSelection: true });
        }
        function onDocPointerDown(ev) {
          if (!inspectorCalloutEl || inspectorCalloutEl.style.display === 'none') return;
          if (inspectorCalloutEl.contains(ev.target)) return;
          if (ev.target.closest && (ev.target.closest('#sidepanel-openMaps') || ev.target.closest('.openmaps-inspector-window'))) return;
          removeGestureListeners();
          inspectorCalloutEl._calloutDismissArm = { x0: ev.clientX, y0: ev.clientY, pid: ev.pointerId, dragged: false };
          inspectorCalloutEl._onDocMove = onDocPointerMove;
          inspectorCalloutEl._onDocUp = onDocPointerUp;
          document.addEventListener('pointermove', onDocPointerMove, true);
          document.addEventListener('pointerup', onDocPointerUp, true);
          document.addEventListener('pointercancel', onDocPointerUp, true);
          try {
            if (olMap && olMap.div && ev.target && typeof olMap.div.contains === 'function' && olMap.div.contains(ev.target)) {
              var onMapMove = function() {
                var arm2 = inspectorCalloutEl && inspectorCalloutEl._calloutDismissArm;
                if (arm2) arm2.dragged = true;
                detachInspectorCalloutMapPanGuard();
              };
              inspectorCalloutEl._onMapMoveArm = onMapMove;
              olMap.events.register('move', null, onMapMove);
            }
          } catch (eArm) { /* ignore */ }
        }
        el._onDoc = onDocPointerDown;
        document.addEventListener('pointerdown', onDocPointerDown, true);
      }, 0);
    }

    function cancelMapEsriHoverMotion() {
      if (mapEsriHoverRaf != null) {
        cancelAnimationFrame(mapEsriHoverRaf);
        mapEsriHoverRaf = null;
      }
      mapEsriHoverPendingEvt = null;
    }

    function selectItem(id) {
      cancelScheduledInspectorHoverHL();
      cancelMapEsriHoverMotion();
      mapEsriHoverLastKey = '';
      selectedId = id;
      var it = viewportItemsById.get(id) || queryItemsById.get(id);
      listHoverHighlightId = it ? id : null;
      renderFullList();
      if (!it) {
        hideInspectorCallout();
        return;
      }
      showInspectorCalloutForItem(id, it);
    }

    function cancelScheduledInspectorHoverHL() {
      if (inspectorHoverHLRaf != null) {
        cancelAnimationFrame(inspectorHoverHLRaf);
        inspectorHoverHLRaf = null;
      }
      inspectorHoverHLPending = null;
    }

    function flushInspectorHoverHL() {
      inspectorHoverHLRaf = null;
      var id = inspectorHoverHLPending;
      inspectorHoverHLPending = null;
      listHoverHighlightId = id;
      applyInspectorDualHighlights();
    }

    /** Batches hover-driven highlight changes so moving across rows does not sync-hit OpenLayers twice per step. */
    function scheduleInspectorListHoverHighlight(id) {
      inspectorHoverHLPending = id;
      if (inspectorHoverHLRaf == null) {
        inspectorHoverHLRaf = requestAnimationFrame(flushInspectorHoverHL);
      }
    }

    function getEffectiveHoverHighlightId() {
      if (inspectorPointerOverList) return listHoverHighlightId;
      return mapHoverHighlightId;
    }

    /** Keep list row `--hov` in sync when map pointer drives hover (no full list rebuild). */
    function syncInspectorListRowHoverClasses() {
      var eff = getEffectiveHoverHighlightId();
      try {
        var rows = listHost.querySelectorAll('.openmaps-inspector-list-row');
        for (var ri = 0; ri < rows.length; ri++) {
          var row = rows[ri];
          var rid = row.dataset.itemId;
          var on = !!(eff && rid === eff);
          if (on) row.classList.add('openmaps-inspector-list-row--hov');
          else row.classList.remove('openmaps-inspector-list-row--hov');
        }
      } catch (eSyncH) { /* ignore */ }
    }

    function clearHighlight() {
      if (highlightSelectLayer && highlightSelectLayer.removeAllFeatures) highlightSelectLayer.removeAllFeatures();
      if (highlightSelectHaloLayer && highlightSelectHaloLayer.removeAllFeatures) highlightSelectHaloLayer.removeAllFeatures();
      if (highlightSelectLiftLayer && highlightSelectLiftLayer.removeAllFeatures) highlightSelectLiftLayer.removeAllFeatures();
      if (highlightHoverLayer && highlightHoverLayer.removeAllFeatures) highlightHoverLayer.removeAllFeatures();
      if (highlightHoverHaloLayer && highlightHoverHaloLayer.removeAllFeatures) highlightHoverHaloLayer.removeAllFeatures();
      if (highlightHoverLiftLayer && highlightHoverLiftLayer.removeAllFeatures) highlightHoverLiftLayer.removeAllFeatures();
      mapHoverHighlightId = null;
      listHoverHighlightId = null;
      try {
        syncOpenMapsLayerIndices();
      } catch (eSync) { /* ignore */ }
      syncInspectorListRowHoverClasses();
    }

    /**
     * Layers to pin top → bottom (first = frontmost). Consumed by pinOpenMapsOverlayStackTop.
     */
    function getInspectorOverlayLayersTopToBottom() {
      var out = [];
      try {
        var om = W.map.getOLMap();
        if (!om || !om.layers) return out;
        function hasFeats(lyr) {
          return lyr && lyr.features && lyr.features.length > 0 && om.layers.indexOf(lyr) >= 0;
        }
        var stack = [
          hasFeats(highlightSelectLayer) ? highlightSelectLayer : null,
          hasFeats(highlightHoverLayer) ? highlightHoverLayer : null,
          hasFeats(highlightSelectLiftLayer) ? highlightSelectLiftLayer : null,
          hasFeats(highlightHoverLiftLayer) ? highlightHoverLiftLayer : null,
          hasFeats(highlightSelectHaloLayer) ? highlightSelectHaloLayer : null,
          hasFeats(highlightHoverHaloLayer) ? highlightHoverHaloLayer : null
        ];
        for (var si = 0; si < stack.length; si++) {
          if (stack[si]) out.push(stack[si]);
        }
        if (inspectorViewportGeomLayer && hasFeats(inspectorViewportGeomLayer)) {
          out.push(inspectorViewportGeomLayer);
        }
      } catch (eG) { /* ignore */ }
      return out;
    }

    /**
     * Delegates to unified stack pin (inspector + ESRI_FEATURE) so highlights stay above viewport geom above ESRI above WME Places.
     */
    function pinInspectorHighlightStack() {
      try {
        pinOpenMapsOverlayStackTop(W.map.getOLMap());
      } catch (ePin) { /* ignore */ }
    }

    function ensureInspectorViewportGeomLayer() {
      if (inspectorViewportGeomLayer) return;
      inspectorViewportGeomLayer = new OpenLayers.Layer.Vector('OpenMapsInspectorViewportGeom', {
        styleMap: new OpenLayers.StyleMap({ 'default': new OpenLayers.Style({}) }),
        displayInLayerSwitcher: false
      });
      W.map.addLayer(inspectorViewportGeomLayer);
    }

    function syncInspectorViewportGeometrySymbols() {
      try {
        if (!isInspectorWinOpen()) {
          if (inspectorViewportGeomLayer && inspectorViewportGeomLayer.removeAllFeatures) inspectorViewportGeomLayer.removeAllFeatures();
          return;
        }
        ensureInspectorViewportGeomLayer();
        inspectorViewportGeomLayer.removeAllFeatures();
        var selId2 = selectedId;
        var effHovId2 = getEffectiveHoverHighlightId();
        var drawHover2 = !!(effHovId2 && effHovId2 !== selId2);
        var skipVg = Object.create(null);
        if (selId2) skipVg[selId2] = true;
        if (drawHover2 && effHovId2) skipVg[effHovId2] = true;
        for (var vgi = 0; vgi < viewportListIds.length; vgi++) {
          var vid = viewportListIds[vgi];
          if (skipVg[vid]) continue;
          var gV = geometryById.get(vid);
          if (!gV) continue;
          var refV = featureRefById.get(vid);
          if (refV && refV.feature) continue;
          var itV = viewportItemsById.get(vid);
          if (!itV) continue;
          var titleV = itV.mapId != null ? mapTitleForInspector(itV.mapId) : '';
          var fillHexV = openMapsMapAvatarColorFromTitle(titleV);
          var gClone = typeof gV.clone === 'function' ? gV.clone() : gV;
          var cnV = gClone && gClone.CLASS_NAME;
          if (cnV === 'OpenLayers.Geometry.Point' || cnV === 'OpenLayers.Geometry.MultiPoint') {
            var packV = openMapsEsriFeatureAvatarMarkerPack(fillHexV);
            var vf = new OpenLayers.Feature.Vector(gClone);
            vf.openMapsInspectorItemId = vid;
            vf.style = openMapsEsriPointVectorStyle(packV);
            inspectorViewportGeomLayer.addFeatures([vf]);
          } else {
            var stV = openMapsInspectorViewportGeomBaseStyle(gClone, fillHexV);
            var vf2 = new OpenLayers.Feature.Vector(gClone);
            vf2.openMapsInspectorItemId = vid;
            vf2.style = stV || null;
            inspectorViewportGeomLayer.addFeatures([vf2]);
          }
        }
      } catch (eVg) { /* ignore */ }
    }

    function ensureInspectorHighlightSelectLayer() {
      if (highlightSelectLayer) return;
      highlightSelectLayer = new OpenLayers.Layer.Vector('OpenMapsInspectorHLsel', {
        styleMap: new OpenLayers.StyleMap({
          'default': new OpenLayers.Style({
            strokeColor: '#1a73e8',
            strokeWidth: 3,
            fillOpacity: 0.15,
            fillColor: '#1a73e8',
            pointRadius: 6
          })
        }),
        displayInLayerSwitcher: false
      });
      W.map.addLayer(highlightSelectLayer);
    }

    function ensureInspectorHighlightHoverLayer() {
      if (highlightHoverLayer) return;
      highlightHoverLayer = new OpenLayers.Layer.Vector('OpenMapsInspectorHLhov', {
        styleMap: new OpenLayers.StyleMap({
          'default': new OpenLayers.Style({
            strokeColor: '#5a9fd4',
            strokeWidth: 2.5,
            fillOpacity: 0.12,
            fillColor: '#5a9fd4',
            pointRadius: 5
          })
        }),
        displayInLayerSwitcher: false
      });
      W.map.addLayer(highlightHoverLayer);
    }

    /** Draw highlighted point above siblings in the same vector layer (OpenLayers paints in feature array order). */
    function bumpEsriPointFeatureToDrawLast(feat, lyr) {
      if (!feat || !lyr || !lyr.features) return;
      try {
        var arr = lyr.features;
        if (arr.length < 2) return;
        if (arr.indexOf(feat) < 0) return;
        lyr.removeFeatures([feat]);
        lyr.addFeatures([feat]);
      } catch (eBump) { /* ignore */ }
    }

    function applyInspectorDualHighlights() {
      try {
        ensureInspectorHighlightSelectLayer();
        ensureInspectorHighlightHoverLayer();
        if (highlightSelectLayer) highlightSelectLayer.removeAllFeatures();
        if (highlightSelectHaloLayer) highlightSelectHaloLayer.removeAllFeatures();
        if (highlightSelectLiftLayer) highlightSelectLiftLayer.removeAllFeatures();
        if (highlightHoverLayer) highlightHoverLayer.removeAllFeatures();
        if (highlightHoverHaloLayer) highlightHoverHaloLayer.removeAllFeatures();
        if (highlightHoverLiftLayer) highlightHoverLiftLayer.removeAllFeatures();

        var selId = selectedId;
        var effHovId = getEffectiveHoverHighlightId();
        var drawHover = !!(effHovId && effHovId !== selId);

        var selBump = { feat: null, lyr: null };
        var hovBump = { feat: null, lyr: null };

        function paintInspectorAvatarPointHighlight(mode, g0, fillHex) {
          if (!g0 || typeof g0.clone !== 'function') return;
          var pack = openMapsEsriFeatureAvatarMarkerPack(fillHex);
          var ringL = mode === 'select' ? highlightSelectLayer : highlightHoverLayer;
          var liftL = mode === 'select' ? highlightSelectLiftLayer : highlightHoverLiftLayer;
          if (!liftL) {
            liftL = new OpenLayers.Layer.Vector(mode === 'select' ? 'OpenMapsInspectorHLselLift' : 'OpenMapsInspectorHLhovLift', {
              styleMap: new OpenLayers.StyleMap({ 'default': new OpenLayers.Style({}) }),
              displayInLayerSwitcher: false
            });
            W.map.addLayer(liftL);
            if (mode === 'select') highlightSelectLiftLayer = liftL;
            else highlightHoverLiftLayer = liftL;
          }
          var liftFeat = new OpenLayers.Feature.Vector(g0.clone());
          liftFeat.style = openMapsEsriPointVectorStyle(pack);
          liftL.addFeatures([liftFeat]);
          var haloL = mode === 'select' ? highlightSelectHaloLayer : highlightHoverHaloLayer;
          if (!haloL) {
            haloL = new OpenLayers.Layer.Vector(mode === 'select' ? 'OpenMapsInspectorHLselHalo' : 'OpenMapsInspectorHLhovHalo', {
              styleMap: new OpenLayers.StyleMap({ 'default': new OpenLayers.Style({}) }),
              displayInLayerSwitcher: false
            });
            W.map.addLayer(haloL);
            if (mode === 'select') highlightSelectHaloLayer = haloL;
            else highlightHoverHaloLayer = haloL;
          }
          var haloR = Math.max(pack.symbolR + pack.whiteW * 0.35, pack.highlightR - pack.hlStroke * 0.45);
          var ringPathR = Math.max(pack.symbolR + pack.whiteW * 0.5, pack.highlightR - pack.hlStroke * 0.5);
          var isHover = mode === 'hover';
          var haloFeat = new OpenLayers.Feature.Vector(g0.clone());
          haloFeat.style = {
            graphicName: 'circle',
            pointRadius: haloR,
            fillColor: isHover ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.95)',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWidth: 0,
            strokeOpacity: 0
          };
          var ringFeat = new OpenLayers.Feature.Vector(g0.clone());
          ringFeat.style = {
            graphicName: 'circle',
            pointRadius: ringPathR,
            fillOpacity: 0,
            strokeColor: '#ffffff',
            strokeWidth: isHover ? Math.max(1, pack.hlStroke - 0.5) : pack.hlStroke,
            strokeOpacity: 1
          };
          haloL.addFeatures([haloFeat]);
          ringL.addFeatures([ringFeat]);
        }

        function paintInspectFeature(mode, feature, sourceLayer) {
          var ringL = mode === 'select' ? highlightSelectLayer : highlightHoverLayer;
          var g0 = feature.geometry;
          var cn0 = g0 && g0.CLASS_NAME;
          var isEsriPoint = sourceLayer && sourceLayer.openMapsEsriAvatarFill &&
            (cn0 === 'OpenLayers.Geometry.Point' || cn0 === 'OpenLayers.Geometry.MultiPoint');
          if (isEsriPoint) {
            paintInspectorAvatarPointHighlight(mode, g0, sourceLayer.openMapsEsriAvatarFill);
            return { feat: feature, lyr: sourceLayer };
          }
          var clone = feature.clone();
          if (sourceLayer && sourceLayer.openMapsEsriAvatarFill) {
            var st = openMapsEsriInspectorHighlightStyle(clone.geometry, sourceLayer.openMapsEsriAvatarFill);
            if (mode === 'hover' && st) {
              if (typeof st.strokeWidth === 'number') st.strokeWidth = Math.max(1, st.strokeWidth - 0.5);
              if (typeof st.strokeOpacity === 'number') st.strokeOpacity = Math.min(1, st.strokeOpacity * 0.88);
            }
            clone.style = st || null;
          } else clone.style = null;
          ringL.addFeatures([clone]);
          return { feat: null, lyr: null };
        }

        function paintInspectItemGeometry(mode, geom, itemId) {
          if (!geom) return;
          var it = viewportItemsById.get(itemId) || queryItemsById.get(itemId);
          var title = it && it.mapId != null ? mapTitleForInspector(it.mapId) : '';
          var fillHex = openMapsMapAvatarColorFromTitle(title);
          var g0 = typeof geom.clone === 'function' ? geom.clone() : geom;
          var cn = g0 && g0.CLASS_NAME;
          if (cn === 'OpenLayers.Geometry.Point' || cn === 'OpenLayers.Geometry.MultiPoint') {
            paintInspectorAvatarPointHighlight(mode, g0, fillHex);
            return;
          }
          var ringL = mode === 'select' ? highlightSelectLayer : highlightHoverLayer;
          var f = new OpenLayers.Feature.Vector(g0);
          var st = openMapsEsriInspectorHighlightStyle(g0, fillHex);
          if (mode === 'hover' && st) {
            if (typeof st.strokeWidth === 'number') st.strokeWidth = Math.max(1, st.strokeWidth - 0.5);
            if (typeof st.strokeOpacity === 'number') st.strokeOpacity = Math.min(1, st.strokeOpacity * 0.88);
          }
          f.style = st || null;
          ringL.addFeatures([f]);
        }

        if (selId) {
          var sref = featureRefById.get(selId);
          if (sref && sref.feature) {
            var rb = paintInspectFeature('select', sref.feature, sref.layer);
            selBump.feat = rb.feat;
            selBump.lyr = rb.lyr;
          } else {
            var sg = geometryById.get(selId);
            if (sg) paintInspectItemGeometry('select', sg, selId);
          }
        }

        if (drawHover) {
          var href = featureRefById.get(effHovId);
          if (href && href.feature) {
            var rh = paintInspectFeature('hover', href.feature, href.layer);
            hovBump.feat = rh.feat;
            hovBump.lyr = rh.lyr;
          } else {
            var hg = geometryById.get(effHovId);
            if (hg) paintInspectItemGeometry('hover', hg, effHovId);
          }
        }

        if (selBump.feat && hovBump.feat && selBump.lyr === hovBump.lyr) {
          bumpEsriPointFeatureToDrawLast(hovBump.feat, selBump.lyr);
          bumpEsriPointFeatureToDrawLast(selBump.feat, selBump.lyr);
        } else {
          if (hovBump.feat && hovBump.lyr) bumpEsriPointFeatureToDrawLast(hovBump.feat, hovBump.lyr);
          if (selBump.feat && selBump.lyr) bumpEsriPointFeatureToDrawLast(selBump.feat, selBump.lyr);
        }

        syncInspectorViewportGeometrySymbols();
        pinInspectorHighlightStack();
        requestAnimationFrame(function() {
          try {
            pinInspectorHighlightStack();
          } catch (ePin2) { /* ignore */ }
        });
        syncInspectorListRowHoverClasses();
      } catch (eDual) {
        clearHighlight();
      }
    }

    function isInspectorHighlightVectorLayer(Lay) {
      return Lay === highlightSelectLayer || Lay === highlightHoverLayer ||
        Lay === highlightSelectHaloLayer || Lay === highlightHoverHaloLayer ||
        Lay === highlightSelectLiftLayer || Lay === highlightHoverLiftLayer;
    }

    /** ESRI_FEATURE layers and the Map Inspector geometry-only symbol layer (WMS/WFS/query). */
    function inspectorMapVectorLayerIsHitTarget(Lay) {
      if (!Lay) return false;
      if (Lay.openMapsEsriAvatarFill) return true;
      return inspectorViewportGeomLayer != null && Lay === inspectorViewportGeomLayer;
    }

    function findTopEsriFeatureFromEvent(evt) {
      if (!evt || evt.xy == null) return null;
      var om = W.map.getOLMap();
      if (!om || !om.layers) return null;
      var n = om.layers.length;
      for (var i = n - 1; i >= 0; i--) {
        var Lay = om.layers[i];
        if (!Lay || isInspectorHighlightVectorLayer(Lay)) continue;
        if (!inspectorMapVectorLayerIsHitTarget(Lay)) continue;
        if (typeof Lay.getVisibility === 'function' && !Lay.getVisibility()) continue;
        if (typeof Lay.getFeatureFromEvent !== 'function') continue;
        try {
          var fe = Lay.getFeatureFromEvent(evt);
          if (fe) return { feature: fe, layer: Lay };
        } catch (eG) { /* next layer */ }
      }
      var ll = null;
      try {
        ll = om.getLonLatFromPixel(evt.xy);
      } catch (eLL) { ll = null; }
      if (!ll || typeof ll.lon !== 'number' || typeof ll.lat !== 'number') return null;
      var px = ll.lon;
      var py = ll.lat;
      var res = typeof om.getResolution === 'function' ? om.getResolution() : null;
      if (res == null || !(res > 0)) return null;
      var tolMap = res * 14;
      var tol2 = tolMap * tolMap;
      for (var j = n - 1; j >= 0; j--) {
        var L2 = om.layers[j];
        if (!L2 || isInspectorHighlightVectorLayer(L2)) continue;
        if (!inspectorMapVectorLayerIsHitTarget(L2)) continue;
        if (typeof L2.getVisibility === 'function' && !L2.getVisibility()) continue;
        var fts = L2.features || [];
        var bestF = null;
        var bestD = Infinity;
        for (var fi = 0; fi < fts.length; fi++) {
          var f = fts[fi];
          var g = f.geometry;
          if (!g) continue;
          var comps = [];
          if (g.CLASS_NAME === 'OpenLayers.Geometry.Point') {
            comps.push(g);
          } else if (g.CLASS_NAME === 'OpenLayers.Geometry.MultiPoint' && g.components) {
            for (var ci = 0; ci < g.components.length; ci++) comps.push(g.components[ci]);
          } else continue;
          for (var pi = 0; pi < comps.length; pi++) {
            var pg = comps[pi];
            if (typeof pg.x !== 'number' || typeof pg.y !== 'number') continue;
            var dx = pg.x - px;
            var dy = pg.y - py;
            var d2 = dx * dx + dy * dy;
            if (d2 < bestD) {
              bestD = d2;
              bestF = f;
            }
          }
        }
        if (bestF != null && bestD <= tol2) return { feature: bestF, layer: L2 };
      }
      return null;
    }

    function esriMapHitCacheKey(hit) {
      if (!hit || !hit.feature || !hit.layer) return '';
      try {
        var vgId = hit.feature.openMapsInspectorItemId;
        if (vgId != null && vgId !== '') {
          return 'omVg|' + String(hit.layer.id) + '|' + String(vgId);
        }
        var g = hit.feature.geometry;
        var xy = (g && typeof g.x === 'number' && typeof g.y === 'number') ? (g.x + ',' + g.y) : '';
        // Do not use feature array index — draw-order bump moves the feature and would change the key every frame.
        var fid = hit.feature.fid != null ? String(hit.feature.fid) : '';
        return String(hit.layer.id) + '|' + fid + '|' + xy;
      } catch (eK) {
        return '';
      }
    }

    function flushMapEsriHover() {
      mapEsriHoverRaf = null;
      var evt = mapEsriHoverPendingEvt;
      mapEsriHoverPendingEvt = null;
      if (!evt) return;
      var hit = findTopEsriFeatureFromEvent(evt);
      var k = esriMapHitCacheKey(hit);
      if (k === mapEsriHoverLastKey) return;
      mapEsriHoverLastKey = k;
      if (hit) {
        var vgH = hit.feature && hit.feature.openMapsInspectorItemId;
        if (vgH != null && vgH !== '') {
          mapHoverHighlightId = vgH;
        } else {
          var mapIdH = openMapsMapIdFromEsriFeatureHitLayer(hit.layer);
          if (mapIdH != null) {
            var fi = (hit.layer.features || []).indexOf(hit.feature);
            mapHoverHighlightId = stableFeatureId(mapIdH, 'main', hit.feature, fi >= 0 ? fi : 0);
          } else {
            mapHoverHighlightId = null;
          }
        }
      } else {
        mapEsriHoverLastKey = '';
        mapHoverHighlightId = null;
      }
      applyInspectorDualHighlights();
    }

    function onOlMapPointerMove(evt) {
      mapEsriHoverPendingEvt = evt;
      if (mapEsriHoverRaf != null) return;
      mapEsriHoverRaf = requestAnimationFrame(flushMapEsriHover);
    }

    function onOlMapDivPointerLeave() {
      mapEsriHoverLastKey = '';
      cancelMapEsriHoverMotion();
      mapHoverHighlightId = null;
      applyInspectorDualHighlights();
    }

    function scheduleViewportRefresh() {
      if (!isInspectorWinOpen()) return;
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = setTimeout(function() {
        moveTimer = null;
        runViewportIndex();
      }, DEBOUNCE_MS);
    }

    function trySelectEsriFeatureFromClick(evt) {
      var hit = findTopEsriFeatureFromEvent(evt);
      if (!hit) return false;
      var vgId = hit.feature && hit.feature.openMapsInspectorItemId;
      if (vgId != null && vgId !== '') {
        function attemptSelectVg() {
          if (viewportItemsById.has(vgId) || queryItemsById.has(vgId)) {
            selectItem(vgId);
            return true;
          }
          return false;
        }
        if (attemptSelectVg()) return true;
        if (!isInspectorWinOpen()) openWin();
        runViewportIndex(true);
        setTimeout(function() { attemptSelectVg(); }, 0);
        return true;
      }
      var mapIdC = openMapsMapIdFromEsriFeatureHitLayer(hit.layer);
      if (mapIdC == null) return false;
      var fi = (hit.layer.features || []).indexOf(hit.feature);
      var sid = stableFeatureId(mapIdC, 'main', hit.feature, fi >= 0 ? fi : 0);
      function attemptSelect() {
        if (viewportItemsById.has(sid) || queryItemsById.has(sid)) {
          selectItem(sid);
          return true;
        }
        return false;
      }
      if (attemptSelect()) return true;
      if (!isInspectorWinOpen()) {
        openWin();
      }
      runViewportIndex(true);
      setTimeout(function() { attemptSelect(); }, 0);
      return true;
    }

    function onMapClick(evt) {
      if (evt && evt._openMapsInspectorClickHandled) return;
      if (trySelectEsriFeatureFromClick(evt)) return;
      if (!isInspectorWinOpen()) return;
      var extent = typeof getMapExtent === 'function' ? getMapExtent() : null;
      if (!extent) return;
      for (var hi = 0; hi < handles.length; hi++) {
        var h = handles[hi];
        var layers = [];
        if (h.bboxLayer && isVectorLayer(h.bboxLayer)) layers.push({ layer: h.bboxLayer, key: 'bbox' });
        if (h.layer && isVectorLayer(h.layer)) layers.push({ layer: h.layer, key: 'main' });
        for (var li = 0; li < layers.length; li++) {
          var L = layers[li].layer;
          if (!L.getVisibility()) continue;
          var f = null;
          try {
            if (typeof L.getFeatureFromEvent === 'function') f = L.getFeatureFromEvent(evt);
          } catch (e) {}
          if (f) {
            var foundId = null;
            featureRefById.forEach(function(ref, rid) {
              if (ref.feature === f) foundId = rid;
            });
            if (foundId) {
              selectItem(foundId);
              return;
            }
            var idx = (L.features || []).indexOf(f);
            var sid = stableFeatureId(h.mapId, layers[li].key, f, idx >= 0 ? idx : 0);
            if (viewportItemsById.has(sid)) selectItem(sid);
            return;
          }
        }
      }
    }

    function registerMapClick() {
      if (mapClickRegistered) return;
      try {
        olMap.events.register('click', null, onMapClick);
        mapClickRegistered = true;
      } catch (e) {}
    }

    /**
     * WME Places/POI overlays often sit above the map in the DOM and receive the click before OpenLayers’ bubble
     * handler runs, so `olMap.events` click never fires. Capture on the document (map area only) runs first
     * and uses the same pixel math + hit-test as ESRI_FEATURE / inspector viewport geometry.
     * OpenMaps overlay vectors use `pointer-events: none` so native Places layers can be the hit target when
     * we do not consume the click (see `applyOpenMapsOverlayZToLayerDiv`).
     */
    function registerInspectorMapClickCapture() {
      if (inspectorMapClickCaptureRegistered) return;
      if (typeof document === 'undefined' || !document.addEventListener) return;
      document.addEventListener('click', function inspectorMapClickCapture(evt) {
        if (evt._openMapsInspectorClickHandled) return;
        try {
          if (evt.button != null && evt.button !== 0) return;
          if (win && (win === evt.target || (typeof win.contains === 'function' && win.contains(evt.target)))) return;
          if (inspectorCalloutEl && inspectorCalloutEl.style.display !== 'none' &&
            typeof inspectorCalloutEl.contains === 'function' && inspectorCalloutEl.contains(evt.target)) return;
          if (!olMap || !olMap.div) return;
          var mapDiv = olMap.div;
          var r = mapDiv.getBoundingClientRect();
          if (evt.clientX < r.left || evt.clientX > r.right || evt.clientY < r.top || evt.clientY > r.bottom) return;
          var pos = OpenLayers.Util.pagePosition(mapDiv);
          var synthetic = { xy: new OpenLayers.Pixel(evt.clientX - pos[0], evt.clientY - pos[1]) };
          if (trySelectEsriFeatureFromClick(synthetic)) {
            evt._openMapsInspectorClickHandled = true;
            evt.preventDefault();
            evt.stopPropagation();
            evt.stopImmediatePropagation();
          }
        } catch (eCap) { /* ignore */ }
      }, true);
      inspectorMapClickCaptureRegistered = true;
    }

    function unregisterMapClick() {
      if (!mapClickRegistered) return;
      try {
        olMap.events.unregister('click', null, onMapClick);
      } catch (e) {}
      mapClickRegistered = false;
    }

    // Inspector root stays open in floating window; still keep the hooks for safety.
    syncMapGroupDefaults();
    registerMapClick();
    registerInspectorMapClickCapture();
    try {
      olMap.events.register('mousemove', null, onOlMapPointerMove);
    } catch (eMm) { /* ignore */ }
    try {
      if (olMap.div) olMap.div.addEventListener('mouseleave', onOlMapDivPointerLeave);
    } catch (eMl) { /* ignore */ }

    if (openMapsWmeSdk && openMapsWmeSdk.Events && typeof openMapsWmeSdk.Events.on === 'function') {
      try {
        openMapsWmeSdk.Events.on({ eventName: 'wme-map-move-end', eventHandler: scheduleViewportRefresh });
        openMapsWmeSdk.Events.on({ eventName: 'wme-map-zoom-changed', eventHandler: scheduleViewportRefresh });
      } catch (eSdkEv) {
        W.map.events.register('moveend', null, scheduleViewportRefresh);
      }
    } else {
      W.map.events.register('moveend', null, scheduleViewportRefresh);
    }

    searchInput.addEventListener('input', function() { renderFullList(); });
    refreshBtn.addEventListener('click', function() { runViewportIndex(true); });

    clearQueryBtn.addEventListener('click', function() {
      queryItemsById.clear();
      queryListIds = [];
      if (selectedId && String(selectedId).indexOf('om-inspector-q-') === 0) {
        selectedId = null;
        hideInspectorCallout();
      }
      renderFullList();
    });

    var tableOverlay = null;
    function ensureTableOverlay() {
      if (tableOverlay) return tableOverlay;
      tableOverlay = document.createElement('div');
      tableOverlay.className = 'openmaps-inspector-table-overlay';
      tableOverlay.style.cssText = 'display:none; position:fixed; inset:0; z-index:100600; background:rgba(0,0,0,0.35); align-items:center; justify-content:center; padding:16px; box-sizing:border-box;';
      var panel = document.createElement('div');
      panel.className = 'openmaps-inspector-table-panel';
      panel.style.cssText = 'background:var(--background_default,#fff); border-radius:8px; max-width:min(96vw,900px); width:100%; max-height:86vh; display:flex; flex-direction:column; box-shadow:0 8px 24px rgba(0,0,0,0.2);';
      var head = document.createElement('div');
      head.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 12px; border-bottom:1px solid #e8eaed;';
      var hTitle = document.createElement('h3');
      hTitle.style.cssText = 'margin:0; font-size:16px;';
      hTitle.textContent = I18n.t('openmaps.inspector_table_title');
      var closeBtn = document.createElement('wz-button');
      closeBtn.setAttribute('size', 'sm');
      closeBtn.setAttribute('color', 'secondary');
      closeBtn.textContent = I18n.t('openmaps.inspector_table_close');
      head.appendChild(hTitle);
      head.appendChild(closeBtn);
      tableOverlay._hTitle = hTitle;
      var searchTable = document.createElement('input');
      searchTable.type = 'search';
      searchTable.className = 'form-control';
      searchTable.placeholder = I18n.t('openmaps.inspector_table_search');
      searchTable.style.cssText = 'margin:8px 12px; width:auto; flex-shrink:0;';
      var wrap = document.createElement('div');
      wrap.style.cssText = 'overflow:auto; padding:0 12px 12px; flex:1; min-height:0;';
      var tableEl = document.createElement('table');
      tableEl.className = 'openmaps-inspector-data-table';
      tableEl.style.cssText = 'width:100%; border-collapse:collapse; font-size:12px;';
      wrap.appendChild(tableEl);
      panel.appendChild(head);
      panel.appendChild(searchTable);
      panel.appendChild(wrap);
      tableOverlay.appendChild(panel);
      document.body.appendChild(tableOverlay);
      closeBtn.addEventListener('click', function() { tableOverlay.style.display = 'none'; });
      tableOverlay.addEventListener('click', function(ev) { if (ev.target === tableOverlay) tableOverlay.style.display = 'none'; });
      tableOverlay._table = tableEl;
      tableOverlay._search = searchTable;
      return tableOverlay;
    }

    var tableSortState = { colIdx: 0, dir: 1 };

    function openDataTableForMap(mapIdStr) {
      var TABLE_ROW_CAP = 500;
      tableSortState.colIdx = 0;
      tableSortState.dir = 1;
      var overlay = ensureTableOverlay();
      var mapTitle = mapTitleForInspector(mapIdStr);
      if (overlay._hTitle) {
        overlay._hTitle.textContent = I18n.t('openmaps.inspector_table_title') + ' — ' + mapTitle;
      }
      var ids = getCombinedOrderedIds();
      var rows = ids.map(function(id) {
        return viewportItemsById.get(id) || queryItemsById.get(id);
      }).filter(function(r) {
        return r && String(r.mapId) === String(mapIdStr);
      });
      var colSet = [];
      rows.forEach(function(row) {
        Object.keys(row.props || {}).forEach(function(k) {
          if (colSet.indexOf(k) === -1) colSet.push(k);
        });
      });
      colSet.sort();
      if (colSet.length > MAX_TABLE_COLS) colSet.length = MAX_TABLE_COLS;
      var baseCols = ['_label', '_source', '_kind'];
      var allCols = baseCols.concat(colSet);

      function cellVal(r, c) {
        if (c === '_label') return r.label || '';
        if (c === '_source') return r.source || '';
        if (c === '_kind') return r.kind || '';
        var p = r.props || {};
        return p[c] != null ? String(p[c]) : '';
      }

      function buildTable(filterText) {
        var ft = (filterText || '').trim().toLowerCase();
        var bodyRows = rows.filter(function(r) {
          if (!ft) return true;
          var blob = (r.label + ' ' + r.source + JSON.stringify(r.props || {})).toLowerCase();
          return blob.indexOf(ft) !== -1;
        });
        if (bodyRows.length > TABLE_ROW_CAP) bodyRows = bodyRows.slice(0, TABLE_ROW_CAP);

        var sc = allCols[tableSortState.colIdx];
        if (sc) {
          bodyRows = bodyRows.slice().sort(function(a, b) {
            var va = cellVal(a, sc);
            var vb = cellVal(b, sc);
            var cmp = va < vb ? -1 : (va > vb ? 1 : 0);
            if (cmp === 0) return 0;
            return cmp * tableSortState.dir;
          });
        }

        var thead = document.createElement('thead');
        var trh = document.createElement('tr');
        allCols.forEach(function(c, ci) {
          var th = document.createElement('th');
          th.style.cssText = 'text-align:left; padding:6px; border-bottom:2px solid #ccc; cursor:pointer; white-space:nowrap;';
          th.textContent = (c.charAt(0) === '_' ? c.slice(1) : c) + (tableSortState.colIdx === ci ? (tableSortState.dir > 0 ? ' ▲' : ' ▼') : '');
          th.addEventListener('click', function() {
            if (tableSortState.colIdx === ci) tableSortState.dir = -tableSortState.dir;
            else {
              tableSortState.colIdx = ci;
              tableSortState.dir = 1;
            }
            buildTable(overlay._search.value);
          });
          trh.appendChild(th);
        });
        thead.appendChild(trh);

        var tbody = document.createElement('tbody');
        bodyRows.forEach(function(r) {
          var tr = document.createElement('tr');
          allCols.forEach(function(c) {
            var td = document.createElement('td');
            td.style.cssText = 'padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top;';
            td.textContent = cellVal(r, c);
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });

        overlay._table.innerHTML = '';
        overlay._table.appendChild(thead);
        overlay._table.appendChild(tbody);
      }

      overlay._search.oninput = function() { buildTable(overlay._search.value); };
      overlay.style.display = 'flex';
      buildTable(overlay._search.value || '');
    }

    function ingestEsriResults(json, mapId, layersStr) {
      var results = (json && Array.isArray(json.results)) ? json.results : [];
      var map = maps.get(mapId);
      var title = map ? map.title : '';
      results.forEach(function(r, idx) {
        var id = 'om-inspector-q-esri-' + mapId + '-' + idx + '-' + Math.random().toString(36).slice(2, 10);
        var attrs = (r && r.attributes && typeof r.attributes === 'object') ? r.attributes : {};
        var props = {};
        Object.keys(attrs).forEach(function(k) { props[k] = attrs[k]; });
        var label = (r.layerName || 'Layer') + (r.value ? (' — ' + r.value) : '');
        queryItemsById.set(id, {
          id: id,
          label: label,
          source: title + ' · ' + (layersStr || ''),
          kind: 'query',
          mapId: mapId,
          props: props,
          bbox: null
        });
        queryListIds.push(id);
      });
      renderFullList();
    }

    function ingestWmsFromContent(contentEl, mapId, layersStr) {
      if (!contentEl) return;
      var map = maps.get(mapId);
      var title = map ? map.title : '';
      var rows = extractWmsGfiTablesFromContentRoot(contentEl);
      rows.forEach(function(props, tix) {
        if (!Object.keys(props).length) return;
        var id = 'om-inspector-q-wms-' + mapId + '-' + tix + '-' + Date.now();
        var label = Object.keys(props)[0] ? (Object.keys(props)[0] + ': ' + props[Object.keys(props)[0]]) : 'WMS';
        queryItemsById.set(id, {
          id: id,
          label: label.slice(0, 120),
          source: title + ' · ' + (layersStr || ''),
          kind: 'query',
          mapId: mapId,
          props: props,
          bbox: null
        });
        queryListIds.push(id);
      });
      renderFullList();
    }

    function maybeAutoIngest(isEsri, payload) {
      if (Settings.get().inspectorQueryIngest !== true) return;
      if (isEsri) ingestEsriResults(payload.json, payload.mapId, payload.layersStr);
      else ingestWmsFromContent(payload.contentEl, payload.mapId, payload.layersStr);
    }

    openMapsInspectorApi = {
      notifyHandlesChanged: function() {
        if (isInspectorWinOpen()) {
          lastInspectorViewportBucket = null;
          syncMapGroupDefaults();
          scheduleViewportRefresh();
        }
      },
      /** ESRI_FEATURE bbox query finished (or cache hit): layer features were replaced; refresh inspector refs for selection highlight. */
      notifyEsriFeatureLayerRefreshed: function() {
        if (!isInspectorWinOpen()) return;
        if (inspectorVectorStaleTimer) clearTimeout(inspectorVectorStaleTimer);
        inspectorVectorStaleTimer = setTimeout(function() {
          inspectorVectorStaleTimer = null;
          if (!isInspectorWinOpen()) return;
          refreshInspectorInMemoryVectorRefs();
          renderFullList();
        }, 0);
      },
      ingestEsriResults: ingestEsriResults,
      ingestWmsFromContent: ingestWmsFromContent,
      maybeAutoIngest: maybeAutoIngest,
      isInspectorOpen: function() { return isInspectorWinOpen(); },
      pinHighlightOnTop: pinInspectorHighlightStack,
      getInspectorOverlayLayersTopToBottom: getInspectorOverlayLayersTopToBottom
    };
  }

  //#region Create tab and layer group
  var tab = await (async function() {
    var tabLabel;
    var tabPane;
    if (openMapsWmeSdk && openMapsWmeSdk.Sidebar && typeof openMapsWmeSdk.Sidebar.registerScriptTab === 'function') {
      try {
        var regSdk = await openMapsWmeSdk.Sidebar.registerScriptTab();
        tabLabel = regSdk.tabLabel;
        tabPane = regSdk.tabPane;
      } catch (eSdkTab) {
        try {
          log('SDK Sidebar.registerScriptTab failed; using W.userscripts: ' + (eSdkTab && eSdkTab.message ? eSdkTab.message : eSdkTab));
        } catch (eL) { /* ignore */ }
        var leg0 = W.userscripts.registerSidebarTab('openMaps');
        tabLabel = leg0.tabLabel;
        tabPane = leg0.tabPane;
        if (W.userscripts.waitForElementConnected) await W.userscripts.waitForElementConnected(tabPane);
      }
    } else {
      var leg1 = W.userscripts.registerSidebarTab('openMaps');
      tabLabel = leg1.tabLabel;
      tabPane = leg1.tabPane;
      if (W.userscripts.waitForElementConnected) await W.userscripts.waitForElementConnected(tabPane);
    }

    tabLabel.innerHTML = '<span class="fa"></span>';
    tabLabel.title = I18n.t('openmaps.tab_title');
    tabPane.id = 'sidepanel-openMaps';

    return tabPane;
  })();

  if (pendingUpdateNoticeMessage) {
    var updateNoticeBox = document.createElement('div');
    updateNoticeBox.className = 'openmaps-sidebar-notice openmaps-sidebar-notice--update';
    var updateNoticePre = document.createElement('pre');
    updateNoticePre.className = 'openmaps-sidebar-notice-body';
    updateNoticePre.textContent = pendingUpdateNoticeMessage;
    var updateNoticeDismiss = document.createElement('wz-button');
    updateNoticeDismiss.className = 'openmaps-wz-btn-compact';
    updateNoticeDismiss.setAttribute('size', 'sm');
    updateNoticeDismiss.setAttribute('color', 'secondary');
    updateNoticeDismiss.textContent = I18n.t('openmaps.notice_dismiss');
    updateNoticeDismiss.addEventListener('click', function() { updateNoticeBox.remove(); });
    updateNoticeBox.appendChild(updateNoticePre);
    updateNoticeBox.appendChild(updateNoticeDismiss);
    tab.appendChild(updateNoticeBox);
    pendingUpdateNoticeMessage = null;
  }

  // New map layer drawer group
  var omGroup = createLayerToggler(null, true, I18n.t('openmaps.layer_group_title'), null);

// Satellite imagery toggle (prefer WME SDK Map.* — WME_LAYER_NAMES has no satellite; layer name stays the internal string)
// --- CACHED SATELLITE IMAGERY TOGGLE ---
  var OPEN_MAPS_SAT_LAYER_NAME = 'satellite_imagery';
  var wazeSatLayer = W.map.getLayerByName(OPEN_MAPS_SAT_LAYER_NAME);
  const satImagery = document.createElement('wz-checkbox');
  var satUseSdk = false;
  if (openMapsWmeSdk && openMapsWmeSdk.Map && typeof openMapsWmeSdk.Map.isLayerVisible === 'function') {
    try {
      satImagery.checked = openMapsWmeSdk.Map.isLayerVisible({ layerName: OPEN_MAPS_SAT_LAYER_NAME });
      satUseSdk = true;
    } catch (eSatSdk) {
      satUseSdk = false;
    }
  }
  if (!satUseSdk) {
    satImagery.checked = wazeSatLayer.getVisibility();
  }

  satImagery.addEventListener('change', function(e) {
    var on = e.target.checked;
    if (satUseSdk && openMapsWmeSdk.Map && typeof openMapsWmeSdk.Map.setLayerVisibility === 'function') {
      try {
        openMapsWmeSdk.Map.setLayerVisibility({ layerName: OPEN_MAPS_SAT_LAYER_NAME, visibility: on });
        return;
      } catch (eSet) { /* fall through */ }
    }
    wazeSatLayer.setVisibility(on);
  });

  if (satUseSdk && openMapsWmeSdk.Events && typeof openMapsWmeSdk.Events.trackLayerEvents === 'function') {
    try {
      openMapsWmeSdk.Events.trackLayerEvents({ layerName: OPEN_MAPS_SAT_LAYER_NAME });
    } catch (eTr) { /* ignore */ }
    try {
      openMapsWmeSdk.Events.on({
        eventName: 'wme-layer-visibility-changed',
        eventHandler: function(payload) {
          if (!payload || payload.layerName !== OPEN_MAPS_SAT_LAYER_NAME) return;
          try {
            satImagery.checked = openMapsWmeSdk.Map.isLayerVisible({ layerName: OPEN_MAPS_SAT_LAYER_NAME });
          } catch (eIs) { /* ignore */ }
        }
      });
    } catch (eOn) { /* ignore */ }
  } else {
    wazeSatLayer.events.register('visibilitychanged', null, function() {
      if (satImagery.checked !== wazeSatLayer.getVisibility()) {
        satImagery.checked = wazeSatLayer.getVisibility();
      }
    });
  }

  satImagery.textContent = I18n.t('openmaps.satellite_imagery');
  tab.appendChild(satImagery);
  // ----------------------------------------

  // Implement tab content
  var activeMapsHeader = document.createElement('div');
  activeMapsHeader.className = 'openmaps-active-maps-header';
  var title = document.createElement('h4');
  title.textContent = I18n.t('openmaps.maps_title');
  activeMapsHeader.appendChild(title);

  var activeMapsFilterMode = document.createElement('select');
  activeMapsFilterMode.className = 'form-control openmaps-active-maps-mode-select';
  activeMapsFilterMode.setAttribute('aria-label', I18n.t('openmaps.active_maps_filter_mode_aria'));
  [
    { v: 'all', t: I18n.t('openmaps.active_maps_filter_all') },
    { v: 'favorites', t: I18n.t('openmaps.active_maps_filter_favorites') },
    { v: 'in_view', t: I18n.t('openmaps.active_maps_filter_in_view') },
    { v: 'visible', t: I18n.t('openmaps.active_maps_filter_visible') },
    { v: 'tou_pending', t: I18n.t('openmaps.active_maps_filter_tou_pending') }
  ].forEach(function(o) {
    var opt = document.createElement('option');
    opt.value = o.v;
    opt.textContent = o.t;
    activeMapsFilterMode.appendChild(opt);
  });
  activeMapsHeader.appendChild(activeMapsFilterMode);
  tab.appendChild(activeMapsHeader);
  activeMapsFilterMode.addEventListener('change', function() { applyActiveMapsFilter(); });

  var activeMapsFilterBar = document.createElement('div');
  activeMapsFilterBar.className = 'openmaps-active-maps-filter-bar';
  var activeMapsFilterInput = document.createElement('input');
  activeMapsFilterInput.type = 'text';
  activeMapsFilterInput.className = 'form-control openmaps-add-map-filter openmaps-active-maps-filter-input';
  activeMapsFilterInput.placeholder = I18n.t('openmaps.active_maps_filter_placeholder');
  activeMapsFilterInput.setAttribute('autocomplete', 'off');
  activeMapsFilterInput.setAttribute('aria-label', I18n.t('openmaps.active_maps_filter_placeholder'));

  var activeMapsFilterEmpty = document.createElement('div');
  activeMapsFilterEmpty.className = 'openmaps-active-maps-filter-empty';
  activeMapsFilterEmpty.style.display = 'none';
  activeMapsFilterEmpty.setAttribute('role', 'status');

  activeMapsFilterBar.appendChild(activeMapsFilterInput);
  activeMapsFilterBar.appendChild(activeMapsFilterEmpty);
  tab.appendChild(activeMapsFilterBar);
  activeMapsFilterInput.addEventListener('input', function() { applyActiveMapsFilter(); });

var handleList = document.createElement('div');
  handleList.className = 'openmaps-map-list';
  tab.appendChild(handleList);

  initOpenMapsInspector(tab);

  // --- SMART DRAG & DROP ENGINE ---
  function refreshMapDrag() {
    sortable(handleList, {
      forcePlaceholderSize: true,
      placeholderClass: 'result',
      handle: '.open-maps-drag-handle'
    });
    // Unbind and rebind to prevent duplicate listeners on refresh
    var listEl = sortable(handleList)[0];
    listEl.removeEventListener('sortupdate', onMapSort);
    listEl.addEventListener('sortupdate', onMapSort);
  }

  var openMapsOverlayAddLayerPinTimer = null;
  var openMapsOverlayMoveEndPinTimer = null;
  /** Debounce for moveend stack pin — constant reordering during pan/zoom can break WME satellite tile loading. */
  var OPEN_MAPS_OVERLAY_MOVEEND_PIN_MS = 220;
  var openMapsOverlayAddLayerHooked = false;
  var openMapsOverlayZTokSeq = 0;
  var openMapsMapProtoResetZHooked = false;

  function openMapsEnsureOverlayZStyleEl() {
    var el = document.getElementById('openmaps-ol-overlay-z-rules');
    if (!el) {
      el = document.createElement('style');
      el.id = 'openmaps-ol-overlay-z-rules';
      el.type = 'text/css';
      el.setAttribute('data-openmaps', 'overlay-z');
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  }

  function openMapsTokenForOverlayLayerDiv(div) {
    if (!div || !div.setAttribute) return null;
    var t = div.getAttribute('data-openmaps-ol-ztok');
    if (!t) {
      openMapsOverlayZTokSeq++;
      t = 'omz' + openMapsOverlayZTokSeq;
      div.setAttribute('data-openmaps-ol-ztok', t);
    }
    if (div.classList && !div.classList.contains('openmaps-ol-overlay-z')) div.classList.add('openmaps-ol-overlay-z');
    return t;
  }

  /**
   * Build the same ordered overlay list as `pinOpenMapsOverlayStackTop` (inspector → ESRI bbox → ESRI main).
   * @returns {Array}
   */
  function openMapsBuildOverlayPinOrdered() {
    var ordered = [];
    try {
      if (openMapsInspectorApi && typeof openMapsInspectorApi.getInspectorOverlayLayersTopToBottom === 'function') {
        ordered = openMapsInspectorApi.getInspectorOverlayLayersTopToBottom();
      }
    } catch (eOrd) {
      ordered = [];
    }
    if (!Array.isArray(ordered)) ordered = [];
    // GOOGLE_MY_MAPS: use syncOpenMapsLayerIndices only — the ESRI-style pin (top OL index + !important z + hoist)
    // breaks WME satellite tile loading when My Maps is the sole overlay.
    var esriList = handles.filter(function(h) {
      return h.layer && h.map && h.map.type === 'ESRI_FEATURE' && openMapsHandleShouldPinOverlayVector(h);
    });
    esriList.forEach(function(h) {
      if (h.bboxLayer) ordered.push(h.bboxLayer);
      if (h.layer) ordered.push(h.layer);
    });
    return ordered;
  }

  function openMapsIsLiveOpenMapsEsriFeatureMainVector(L) {
    return !!(L && L.CLASS_NAME === 'OpenLayers.Layer.Vector' && L.name &&
      String(L.name).indexOf('OpenMaps_ESRI_FEATURE_') === 0);
  }

  function openMapsIsLiveOpenMapsGoogleMyMapsVector(L) {
    return !!(L && L.CLASS_NAME === 'OpenLayers.Layer.Vector' && L.name &&
      String(L.name).indexOf('OpenMaps_GOOGLE_MY_MAPS_') === 0);
  }

  function openMapsOverlayLayerIsOpenMapsBbox(L) {
    if (!L) return false;
    if (L.openMapsBboxMapId != null && L.openMapsBboxMapId !== '') return true;
    var nm = L.name;
    return nm != null && String(nm).indexOf('BBOX_') === 0;
  }

  function openMapsMapIdFromOverlayVectorLayer(L) {
    if (!L) return null;
    try {
      if (L.openMapsMapId != null && L.openMapsMapId !== '') {
        if (typeof L.openMapsMapId === 'number' && !isNaN(L.openMapsMapId)) return L.openMapsMapId;
        var sId = String(L.openMapsMapId).trim();
        if (/^-?\d+$/.test(sId)) return parseInt(sId, 10);
        return L.openMapsMapId;
      }
      if (L.openMapsBboxMapId != null && L.openMapsBboxMapId !== '') {
        if (typeof L.openMapsBboxMapId === 'number' && !isNaN(L.openMapsBboxMapId)) return L.openMapsBboxMapId;
        var sB = String(L.openMapsBboxMapId).trim();
        if (/^-?\d+$/.test(sB)) return parseInt(sB, 10);
        return L.openMapsBboxMapId;
      }
    } catch (eMid) { /* ignore */ }
    var nm = L.name;
    if (nm == null) return null;
    var s = String(nm);
    if (s.indexOf('OpenMaps_ESRI_FEATURE_') === 0) {
      var restE = s.slice('OpenMaps_ESRI_FEATURE_'.length);
      if (/^-?\d+$/.test(restE)) {
        var a = parseInt(restE, 10);
      return isNaN(a) ? null : a;
      }
      return restE || null;
    }
    if (s.indexOf('OpenMaps_GOOGLE_MY_MAPS_') === 0) {
      var tailG = s.slice('OpenMaps_GOOGLE_MY_MAPS_'.length);
      return tailG || null;
    }
    if (s.indexOf('BBOX_') === 0) {
      var restB = s.slice('BBOX_'.length);
      if (/^-?\d+$/.test(restB)) {
        var b = parseInt(restB, 10);
      return isNaN(b) ? null : b;
      }
      return restB || null;
    }
    return null;
  }

  function openMapsHandleForOverlayVectorLayer(L) {
    var mid = openMapsMapIdFromOverlayVectorLayer(L);
    if (mid == null || mid === '') return null;
    for (var hi = 0; hi < handles.length; hi++) {
      var hh = handles[hi];
      if (hh && String(hh.mapId) === String(mid)) return hh;
    }
    return null;
  }

  /** ESRI_FEATURE only: OL top + CSS overlay pin vs WME Places (not used for GOOGLE_MY_MAPS — see sync-only note above). */
  function openMapsHandleShouldPinOverlayVector(h) {
    if (!h || !h.layer || !h.map) return false;
    if (h.map.type !== 'ESRI_FEATURE') return false;
    if (h.hidden || h.outOfArea) return false;
    try {
      if (!h.layer.getVisibility()) return false;
    } catch (eVis) { return false; }
    return true;
  }

  /** True when ESRI overlay pin or inspector overlays need the global `setZIndex` / stylesheet reapply path (skip when only My Maps / tiles). */
  function openMapsOverlayPinStackHasWork() {
    for (var pi = 0; pi < handles.length; pi++) {
      var hp = handles[pi];
      if (hp && hp.map && hp.map.type === 'ESRI_FEATURE' && openMapsHandleShouldPinOverlayVector(hp)) return true;
    }
    try {
      if (openMapsInspectorApi && typeof openMapsInspectorApi.getInspectorOverlayLayersTopToBottom === 'function') {
        var ins = openMapsInspectorApi.getInspectorOverlayLayersTopToBottom();
        if (Array.isArray(ins) && ins.length > 0) return true;
      }
    } catch (eIns) { /* ignore */ }
    return false;
  }

  /**
   * GOOGLE_MY_MAPS: never participate in `syncOpenMapsLayerIndices` `setLayerIndex`.
   * Even visible KML vectors were still reindexed above aerial on every sync/KML load and could break WME satellite tiles after pan/zoom.
   * My Maps stays at WME/OpenLayers default order after `addLayer`; tile/WMS/ESRI rows still stack above aerial.
   */
  function openMapsHandleParticipatesInLayerIndexSync(h) {
    if (!h || !h.layer) return false;
    if (h.map && h.map.type === 'GOOGLE_MY_MAPS') return false;
    return true;
  }

  function openMapsOverlayExtraVectorShouldPin(L) {
    if (!L) return false;
    if (openMapsIsLiveOpenMapsGoogleMyMapsVector(L)) return false;
    if (!(openMapsOverlayLayerIsOpenMapsBbox(L) || openMapsIsLiveOpenMapsEsriFeatureMainVector(L))) return false;
    var hh = openMapsHandleForOverlayVectorLayer(L);
    return !!(hh && openMapsHandleShouldPinOverlayVector(hh));
  }

  function openMapsHandleOrderIndexForOverlayLayer(L) {
    var mid = openMapsMapIdFromOverlayVectorLayer(L);
    if (mid == null || mid === '') return 1e9;
    if (typeof mid === 'number' && isNaN(mid)) return 1e9;
    for (var i = 0; i < handles.length; i++) {
      if (handles[i] && String(handles[i].mapId) === String(mid)) return i;
    }
    return 1e9;
  }

  /**
   * Resolve `ordered` to layers that actually appear on `olMap.layers` (no stale handle refs), then append any
   * ESRI_FEATURE main or OpenMaps bbox vector still on the map but missing from that list — otherwise `setLayerIndex`
   * is skipped and z-index tokens can stick to a detached `div` while idle symbols render on WME’s live layer.
   * Swept layers are sorted by **handles** (Active Maps) order so repeated pins do not reshuffle FeatureServer stacks.
   */
  function openMapsLiveOverlayLayersForPinAndZ(olMap, ordered) {
    var out = [];
    var seen = Object.create(null);
    if (!olMap || !olMap.layers) return out;
    if (Array.isArray(ordered)) {
      for (var i = 0; i < ordered.length; i++) {
        var r = openMapsResolveLayerOnOlMap(olMap, ordered[i]);
        if (!r || olMap.layers.indexOf(r) < 0) continue;
        var nk = r.name;
        if (nk == null || nk === '') continue;
        if (seen[nk]) continue;
        seen[nk] = true;
        out.push(r);
      }
    }
    var extras = [];
    for (var j = 0; j < olMap.layers.length; j++) {
      var L = olMap.layers[j];
      if (!L || !L.name || seen[L.name]) continue;
      if (L.CLASS_NAME !== 'OpenLayers.Layer.Vector') continue;
      if (!openMapsOverlayExtraVectorShouldPin(L)) continue;
      extras.push(L);
    }
    extras.sort(function(a, b) {
      var ia = openMapsHandleOrderIndexForOverlayLayer(a);
      var ib = openMapsHandleOrderIndexForOverlayLayer(b);
      if (ia !== ib) return ia - ib;
      var ab = openMapsOverlayLayerIsOpenMapsBbox(a);
      var bb = openMapsOverlayLayerIsOpenMapsBbox(b);
      if (ab !== bb) return ab ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });
    for (var ex = 0; ex < extras.length; ex++) {
      var E = extras[ex];
      seen[E.name] = true;
      out.push(E);
    }
    return out;
  }

  function openMapsWmeOlMapOrNull() {
    try {
      return (typeof W !== 'undefined' && W.map && typeof W.map.getOLMap === 'function') ? W.map.getOLMap() : null;
    } catch (eWm) {
      return null;
    }
  }

  /** Re-apply high `!important` z-index on overlay layer divs only (no `setLayerIndex`). */
  function openMapsReapplyOverlayLayerDivZs(olMap) {
    if (!olMap) return;
    var wmeOm = openMapsWmeOlMapOrNull();
    if (!wmeOm || olMap !== wmeOm) return;
    if (!openMapsOverlayPinStackHasWork()) {
      try {
        var stNw = openMapsEnsureOverlayZStyleEl();
        stNw.textContent = '';
      } catch (eNw) { /* ignore */ }
      return;
    }
    var ord = openMapsBuildOverlayPinOrdered();
    if (!ord.length) {
      try {
        var st0 = openMapsEnsureOverlayZStyleEl();
        st0.textContent = '';
      } catch (eClr) { /* ignore */ }
      return;
    }
    applyOpenMapsOverlayLayerDivZ(olMap, ord);
  }

  /**
   * OpenLayers 2 `Layer.setZIndex` does `div.style.zIndex = n`, which removes a prior inline `z-index` with
   * `!important`. WME/OL call this after redraw and `resetLayersZIndex`, so idle ESRI symbols sink under Places.
   */
  function openMapsScheduleReapplyOverlayLayerDivZs(olMap) {
    if (!openMapsOverlayPinStackHasWork()) return;
    if (!olMap || olMap.__openmapsReapplyZsRaf != null) return;
    var wmeOmS = openMapsWmeOlMapOrNull();
    if (!wmeOmS || olMap !== wmeOmS) return;
    olMap.__openmapsReapplyZsRaf = requestAnimationFrame(function() {
      olMap.__openmapsReapplyZsRaf = null;
      try {
        openMapsReapplyOverlayLayerDivZs(olMap);
      } catch (eR) { /* ignore */ }
    });
  }

  var openMapsLayerSetZIndexHooked = false;

  /**
   * Polyfill / coexistence hook (not in WME SDK): OpenLayers 2 applies plain inline `z-index` in
   * `Layer.setZIndex` / `Map.resetLayersZIndex`, which clears our overlay stacking vs WME Places.
   * Re-applies only when the map instance is `W.map.getOLMap()`; other OL maps are ignored in the hook body.
   */
  function ensureOpenMapsLayerSetZIndexHook() {
    if (openMapsLayerSetZIndexHooked) return;
    if (typeof OpenLayers === 'undefined' || !OpenLayers.Layer || !OpenLayers.Layer.prototype) return;
    var proto = OpenLayers.Layer.prototype;
    if (typeof proto.setZIndex !== 'function') return;
    openMapsLayerSetZIndexHooked = true;
    var origSetZ = proto.setZIndex;
    proto.setZIndex = function(zIndex) {
      origSetZ.apply(this, arguments);
      try {
        var om = this.map;
        if (om) openMapsScheduleReapplyOverlayLayerDivZs(om);
      } catch (eZ) { /* ignore */ }
    };
  }

  /** Companion to `ensureOpenMapsLayerSetZIndexHook`: wraps `OpenLayers.Map.prototype.resetLayersZIndex`; reapplies only for `W.map.getOLMap()`. */
  function ensureOpenMapsMapPrototypeResetLayersZIndexHook() {
    if (openMapsMapProtoResetZHooked) return;
    if (typeof OpenLayers === 'undefined' || !OpenLayers.Map || !OpenLayers.Map.prototype) return;
    var proto = OpenLayers.Map.prototype;
    var innerProto = proto.resetLayersZIndex;
    if (typeof innerProto !== 'function') return;
    openMapsMapProtoResetZHooked = true;
    proto.resetLayersZIndex = function() {
      var r = innerProto.apply(this, arguments);
      try {
        var wmeOmP = openMapsWmeOlMapOrNull();
        if (wmeOmP && this === wmeOmP) openMapsReapplyOverlayLayerDivZs(this);
      } catch (ePZ) { /* ignore */ }
      return r;
    };
  }

  function ensureOpenMapsMapResetLayersZIndexHook(olMap) {
    ensureOpenMapsMapPrototypeResetLayersZIndexHook();
    if (!olMap || olMap.__openmapsResetZHooked) return;
    var inner = olMap.resetLayersZIndex;
    if (typeof inner !== 'function') return;
    olMap.__openmapsResetZHooked = true;
    olMap.resetLayersZIndex = function() {
      var r = inner.apply(olMap, arguments);
      try {
        openMapsReapplyOverlayLayerDivZs(olMap);
      } catch (eRZ) { /* ignore */ }
      return r;
    };
  }

  /**
   * WME may register a different `OpenLayers.Layer` instance on `olMap.layers` than the object we keep on
   * the map handle (wrapper/proxy or internal replacement). `indexOf(handleLayer)` is then −1, so
   * `setLayerIndex` and `layer.div` styling no-op or hit a detached div — default ESRI_FEATURE symbols stay
   * under native layers while inspector-only layers (still the same refs) pin correctly. Match by
   * `openMapsMapId` (ESRI_FEATURE) then `name` (unique per map row for ESRI_FEATURE since 2026.04.03.16).
   */
  function openMapsResolveLayerOnOlMap(olMap, lyr) {
    if (!olMap || !olMap.layers || !lyr) return null;
    try {
      if (olMap.layers.indexOf(lyr) >= 0) return lyr;
    } catch (eR) {
      return null;
    }
    var mid = lyr.openMapsMapId;
    var list = olMap.layers;
    if (mid != null && mid !== '') {
      for (var mi = 0; mi < list.length; mi++) {
        var candM = list[mi];
        if (candM && candM.openMapsMapId === mid) return candM;
      }
    }
    var nm = lyr.name;
    if (nm == null || nm === '') return null;
    for (var li = 0; li < list.length; li++) {
      var cand = list[li];
      if (cand && cand.name === nm) return cand;
    }
    return null;
  }

  /** Resolve catalog `mapId` from the **live** hit layer (handle ref may be stale after WME replaces OL.Vector). */
  function openMapsMapIdFromEsriFeatureHitLayer(hitLy) {
    if (!hitLy) return null;
    try {
      if (hitLy.openMapsMapId != null && hitLy.openMapsMapId !== '') {
        if (typeof hitLy.openMapsMapId === 'number' && !isNaN(hitLy.openMapsMapId)) return hitLy.openMapsMapId;
        var sHit = String(hitLy.openMapsMapId).trim();
        if (/^-?\d+$/.test(sHit)) return parseInt(sHit, 10);
        return hitLy.openMapsMapId;
      }
    } catch (e0) { /* ignore */ }
    var nm = hitLy.name;
    if (nm != null && String(nm).indexOf('OpenMaps_ESRI_FEATURE_') === 0) {
      var restEf = String(nm).slice('OpenMaps_ESRI_FEATURE_'.length);
      if (/^-?\d+$/.test(restEf)) {
        var idn = parseInt(restEf, 10);
      if (!isNaN(idn)) return idn;
      }
    }
    if (nm != null && String(nm).indexOf('OpenMaps_GOOGLE_MY_MAPS_') === 0) {
      var idg = String(nm).slice('OpenMaps_GOOGLE_MY_MAPS_'.length);
      return idg || null;
    }
    var omH = openMapsWmeOlMapOrNull();
    for (var hi = 0; hi < handles.length; hi++) {
      var h = handles[hi];
      if (!h || !h.map) continue;
      if (h.map.type !== 'ESRI_FEATURE' && h.map.type !== 'GOOGLE_MY_MAPS') continue;
      if (h.layer === hitLy) return h.mapId;
      try {
        if (omH && openMapsResolveLayerOnOlMap(omH, h.layer) === hitLy) return h.mapId;
      } catch (eH) { /* ignore */ }
    }
    return null;
  }

  /** When OL layer divs are direct children of `viewPortDiv`, move ours to the end so paint order wins z-index ties. */
  function openMapsHoistOverlayLayerDivsInViewport(olMap, live) {
    if (!olMap || !olMap.viewPortDiv || !live || !live.length) return;
    var vp = olMap.viewPortDiv;
    try {
      for (var hi = 0; hi < live.length; hi++) {
        var div = live[hi] && live[hi].div;
        if (!div || div.nodeType !== 1) continue;
        if (div.parentNode === vp) vp.appendChild(div);
      }
    } catch (eHoist) { /* ignore */ }
  }

  /**
   * WME Places and other native vectors often set CSS z-index on layer divs; OpenLayers layer index alone
   * does not change stacking within the map viewport. Frontmost layer in the array gets the highest z-index.
   */
  /**
   * Pin overlay stacking via a stylesheet with `!important`. OpenLayers 2 assigns `div.style.zIndex` without
   * `!important`, which overrides a prior inline `setProperty(..., 'important')` on the same declaration.
   * Author `!important` rules in a stylesheet still beat non-important inline z-index, so idle ESRI symbols
   * stay above WME Places after `resetLayersZIndex` / redraw.
   *
   * **`pointer-events: none`**: overlay vectors are siblings of WME Places layer divs; if our canvas is the top
   * hit target, Places never receives clicks (events do not bubble across sibling subtrees). ESRI picks use
   * document capture + `evt.xy` hit-testing; OL `mousemove` still targets the map below.
   */
  function applyOpenMapsOverlayZToLayerDiv(lyrZ, zStr, cssChunks, mapCssPfx) {
    if (!lyrZ || !lyrZ.div) return;
    try {
      var div = lyrZ.div;
      div.style.position = div.style.position || 'absolute';
      var tok = openMapsTokenForOverlayLayerDiv(div);
      if (tok && cssChunks) {
        var pfx = mapCssPfx ? String(mapCssPfx) : '';
        var sel = '.openmaps-ol-overlay-z[data-openmaps-ol-ztok="' + tok + '"]';
        cssChunks.push(
          pfx + sel + '{z-index:' + zStr + '!important;position:absolute!important;pointer-events:none!important;}',
          pfx + sel + ' canvas,' + pfx + sel + ' svg{z-index:' + zStr + '!important;position:relative!important;pointer-events:none!important;}'
        );
      }
    } catch (eZ) { /* ignore */ }
  }

  function applyOpenMapsOverlayLayerDivZFromLive(olMap, live) {
    if (!live || !live.length) return;
    // Assign from the top of the 32-bit CSS z-index range downward. The old domZBase+n-zi formula left the
    // backmost layer (usually the main ESRI_FEATURE vector with all default symbols) at only "base+1" while
    // inspector lift/halo layers sat ~base+n. WME Places often uses values *between* those, so default symbols
    // painted under Places while hover/selection clones (on lift layers) still looked correct.
    var zTop = 2147483647;
    var n = live.length;
    var cssChunks = [];
    var mapCssPfx = '';
    try {
      if (olMap && olMap.div && olMap.div.id) mapCssPfx = '#' + olMap.div.id + ' ';
    } catch (eMq) { /* ignore */ }
    for (var zi = 0; zi < n; zi++) {
      applyOpenMapsOverlayZToLayerDiv(live[zi], String(zTop - zi), cssChunks, mapCssPfx);
    }
    try {
      var st = openMapsEnsureOverlayZStyleEl();
      st.textContent = '/* OpenMaps: overlay z-index (!important; survives OL inline zIndex) */\n' + cssChunks.join('');
    } catch (eSt) { /* ignore */ }
  }

  function applyOpenMapsOverlayLayerDivZ(olMap, orderedRaw) {
    var live = openMapsLiveOverlayLayersForPinAndZ(olMap, orderedRaw);
    applyOpenMapsOverlayLayerDivZFromLive(olMap, live);
  }

  /**
   * Single stack for Map Inspector overlays + geometry-only symbols + ESRI_FEATURE vectors above WME Places/POI.
   * Order (frontmost first): highlight rings/halos/lifts → viewport-geom symbols → each ESRI bbox then main layer.
   */
  function pinOpenMapsOverlayStackTop(olMap) {
    if (!olMap || !olMap.layers) return;
    var rawOrdered = openMapsBuildOverlayPinOrdered();
    var live = openMapsLiveOverlayLayersForPinAndZ(olMap, rawOrdered);
    if (!live.length) {
      try {
        var stClr = openMapsEnsureOverlayZStyleEl();
        stClr.textContent = '';
      } catch (eClrPin) { /* ignore */ }
      return;
    }
    ensureOpenMapsLayerSetZIndexHook();
    ensureOpenMapsMapResetLayersZIndexHook(olMap);
    var u = olMap.layers.length - 1;
    for (var pi = 0; pi < live.length; pi++) {
      var lyr = live[pi];
      if (!lyr || olMap.layers.indexOf(lyr) < 0) continue;
      var Ln = olMap.layers.length;
      if (Ln < 1) return;
      u = Math.min(u, Ln - 1);
      olMap.setLayerIndex(lyr, Math.max(0, u));
      u--;
    }
    applyOpenMapsOverlayLayerDivZFromLive(olMap, live);
    openMapsHoistOverlayLayerDivsInViewport(olMap, live);
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        try {
          var liveR = openMapsLiveOverlayLayersForPinAndZ(olMap, openMapsBuildOverlayPinOrdered());
          if (!liveR.length) {
            try {
              var stRaf = openMapsEnsureOverlayZStyleEl();
              stRaf.textContent = '';
            } catch (eClrRaf) { /* ignore */ }
          } else {
          applyOpenMapsOverlayLayerDivZFromLive(olMap, liveR);
          openMapsHoistOverlayLayerDivsInViewport(olMap, liveR);
          }
        } catch (eRaf) { /* ignore */ }
      });
    });
  }

  function ensureOpenMapsOverlayPinOnAddLayer(olMap) {
    if (openMapsOverlayAddLayerHooked || !olMap || !olMap.events) return;
    if (!openMapsOverlayPinStackHasWork()) return;
    try {
      openMapsOverlayAddLayerHooked = true;
      ensureOpenMapsLayerSetZIndexHook();
      ensureOpenMapsMapResetLayersZIndexHook(olMap);
      olMap.events.register('addlayer', null, function() {
        if (openMapsOverlayAddLayerPinTimer) clearTimeout(openMapsOverlayAddLayerPinTimer);
        openMapsOverlayAddLayerPinTimer = setTimeout(function() {
          openMapsOverlayAddLayerPinTimer = null;
          try {
            pinOpenMapsOverlayStackTop(olMap);
          } catch (ePin) { /* ignore */ }
        }, 0);
      });
      olMap.events.register('moveend', null, function() {
        if (openMapsOverlayMoveEndPinTimer) clearTimeout(openMapsOverlayMoveEndPinTimer);
        openMapsOverlayMoveEndPinTimer = setTimeout(function() {
          openMapsOverlayMoveEndPinTimer = null;
          try {
            pinOpenMapsOverlayStackTop(olMap);
          } catch (eMov) { /* ignore */ }
        }, OPEN_MAPS_OVERLAY_MOVEEND_PIN_MS);
      });
    } catch (eHook) { /* ignore */ }
  }

  /**
   * Aerial / satellite floor in **OpenLayers stack order** (`getLayerIndex`), not raw `layers[]` enumeration index.
   * Mixing `W.map.getLayerIndex` with `olMap.layers` loop positions broke `minForeignAbove` / tile slot math when those diverged.
   */
  function openMapsAerialStackFloorForSync(olMap, wazeLayers) {
    var floor = 0;
    if (olMap && olMap.layers && typeof olMap.getLayerIndex === 'function' && wazeLayers && wazeLayers.length) {
      for (var wi = 0; wi < wazeLayers.length; wi++) {
        var wl = wazeLayers[wi];
        try {
          if (wl && (wl.project === 'earthengine-legacy' || wl.name === OPEN_MAPS_SAT_LAYER_NAME)) {
            if (olMap.layers.indexOf(wl) >= 0) {
              var ix = olMap.getLayerIndex(wl);
              if (ix > floor) floor = ix;
            }
          }
        } catch (eW) { /* ignore */ }
      }
    }
    if (floor > 0) return floor;
    if (olMap && olMap.layers && typeof olMap.getLayerIndex === 'function') {
      for (var j = 0; j < olMap.layers.length; j++) {
        var L = olMap.layers[j];
        if (!L || L.name == null) continue;
        try {
          if (String(L.name) === OPEN_MAPS_SAT_LAYER_NAME) return olMap.getLayerIndex(L);
        } catch (eL) { /* ignore */ }
      }
    }
    return 0;
  }

  /** Stack OpenMaps tile layers above satellite: first row in sidebar = frontmost among our maps, but never above native WME layers (roads, etc.). */
  function syncOpenMapsLayerIndices() {
    const olMap = W.map.getOLMap();
    var diagOn = typeof openMapsGmmDiagEnabled === 'function' && openMapsGmmDiagEnabled();
    var nOlBefore = diagOn && olMap && olMap.layers ? olMap.layers.length : -1;
    if (diagOn) {
      openMapsGmmDiagPrintHelpOnce();
      openMapsGmmDiagMaybeWrapOlMapSetLayerIndex(olMap);
      openMapsGmmDiagMaybeWrapOlMapRemoveLayer(olMap);
      openMapsGmmDiagMaybeWrapWMapRemoveLayer();
      openMapsGmmDiagOlStackSnapshot(olMap, 'sync:before');
    }
    try {
    const wazeLayers = W.map.getLayers();
    const aerialImageryIndex = openMapsAerialStackFloorForSync(olMap, wazeLayers);

    // Use live OL refs: W.map.getLayers() entries may not be `===` handles[].layer (My Maps is added as raw OpenLayers.Vector).
    const ourOlRefs = new Set();
    handles.forEach((h) => {
      if (h.layer) {
        const rL = olMap ? (openMapsResolveLayerOnOlMap(olMap, h.layer) || h.layer) : h.layer;
        ourOlRefs.add(rL);
      }
      if (h.bboxLayer) {
        const rB = olMap ? (openMapsResolveLayerOnOlMap(olMap, h.bboxLayer) || h.bboxLayer) : h.bboxLayer;
        ourOlRefs.add(rB);
      }
    });

    let minForeignAbove = Infinity;
    if (olMap && olMap.layers && typeof olMap.getLayerIndex === 'function') {
      for (let li = 0; li < olMap.layers.length; li++) {
        const L = olMap.layers[li];
        if (!L || ourOlRefs.has(L)) continue;
        const stackIx = olMap.getLayerIndex(L);
        if (stackIx > aerialImageryIndex && stackIx < minForeignAbove) minForeignAbove = stackIx;
      }
    }

    if (diagOn) {
      var participatingN = handles.filter(h => h.layer && openMapsHandleParticipatesInLayerIndexSync(h)).length;
      openMapsGmmDiagLog('sync:computed', {
        aerialImageryIndex: aerialImageryIndex,
        minForeignAbove: minForeignAbove === Infinity ? null : minForeignAbove,
        wazeLayerCount: wazeLayers ? wazeLayers.length : null,
        olLayerCount: olMap && olMap.layers ? olMap.layers.length : null,
        handleWithLayer: handles.filter(h => h.layer).length,
        participating: participatingN
      });
    }

    if (!handles.some(h => h.layer)) {
      pinOpenMapsOverlayStackTop(olMap);
      ensureOpenMapsOverlayPinOnAddLayer(olMap);
      return;
    }

    const participating = handles.filter(h => h.layer && openMapsHandleParticipatesInLayerIndexSync(h));
    const len = participating.length;
    if (len === 0) {
      pinOpenMapsOverlayStackTop(olMap);
      ensureOpenMapsOverlayPinOnAddLayer(olMap);
      return;
    }

    const floorZ = aerialImageryIndex + 1;
    let topIndex = aerialImageryIndex + len;
    if (minForeignAbove !== Infinity) {
      const maxOurZ = minForeignAbove - 1;
      if (topIndex > maxOurZ) topIndex = maxOurZ;
    }
    let bottomIndex = topIndex - len + 1;
    if (bottomIndex < floorZ) {
      bottomIndex = floorZ;
      topIndex = bottomIndex + len - 1;
      if (minForeignAbove !== Infinity && topIndex > minForeignAbove - 1) {
        topIndex = minForeignAbove - 1;
        bottomIndex = Math.max(floorZ, topIndex - len + 1);
      }
    }

    handles.forEach((h) => {
      if (!h.layer) return;
      if (!openMapsHandleParticipatesInLayerIndexSync(h)) return;
      const rank = participating.indexOf(h);
      if (rank < 0) return;
      const z = Math.max(floorZ, topIndex - rank);
      const lyrOl = openMapsResolveLayerOnOlMap(olMap, h.layer) || h.layer;
      if (olMap.layers.indexOf(lyrOl) >= 0) olMap.setLayerIndex(lyrOl, z);
    });

    const maxOurZ = minForeignAbove === Infinity ? Infinity : minForeignAbove - 1;
    handles.forEach(h => {
      if (!h.layer || !h.bboxLayer) return;
      if (!openMapsHandleParticipatesInLayerIndexSync(h)) return;
      const mainOl = openMapsResolveLayerOnOlMap(olMap, h.layer) || h.layer;
      const bboxOl = openMapsResolveLayerOnOlMap(olMap, h.bboxLayer) || h.bboxLayer;
      if (olMap.layers.indexOf(mainOl) < 0 || olMap.layers.indexOf(bboxOl) < 0) return;
      const ti = olMap.getLayerIndex(mainOl);
      let bi = ti + 1;
      if (maxOurZ !== Infinity && bi > maxOurZ) bi = maxOurZ;
      if (bi <= ti) bi = ti;
      olMap.setLayerIndex(bboxOl, bi);
    });

    pinOpenMapsOverlayStackTop(olMap);
    ensureOpenMapsOverlayPinOnAddLayer(olMap);
    } finally {
      if (diagOn && olMap && olMap.layers) {
        var nAfter = olMap.layers.length;
        if (nOlBefore >= 0 && nAfter !== nOlBefore) {
          openMapsGmmDiagLog('ALERT olMap.layers.length changed during sync', { before: nOlBefore, after: nAfter });
        }
        openMapsGmmDiagOlStackSnapshot(olMap, 'sync:after');
      }
    }
  }

function onMapSort() {
    const nodes = handleList.querySelectorAll('.maps-menu-item');
    const newHandles = [];

    nodes.forEach(node => {
      const h = handles.find(handle => String(handle.mapId) === String(node.dataset.mapId));
      if (h) newHandles.push(h);
    });
    handles = newHandles;

    syncOpenMapsLayerIndices();
    handles.forEach((h) => {
      if (h.togglerNode) h.togglerNode.parentNode.appendChild(h.togglerNode);
    });

    saveMapState();
  }
  // --------------------------------

  // Select box to add new Open Maps maps
// --- NATIVE SEARCHABLE MAP SELECTOR ---
    var addMapContainer = document.createElement('div');
    addMapContainer.style.position = 'relative';
    addMapContainer.style.marginTop = '8px';
    addMapContainer.style.marginBottom = '32px'; // Added significant gap below

  var addMapInput = document.createElement('input');
  addMapInput.type = 'text';
  addMapInput.className = 'form-control openmaps-add-map-filter';
  addMapInput.placeholder = I18n.t('openmaps.select_map');
  addMapInput.setAttribute('autocomplete', 'off');
  addMapInput.setAttribute('aria-autocomplete', 'list');
  addMapInput.setAttribute('aria-controls', 'openmaps-add-map-suggestions');

  var addMapSuggestions = document.createElement('div');
  addMapSuggestions.id = 'openmaps-add-map-suggestions';
  addMapSuggestions.className = 'openmaps-add-map-suggestions';
  addMapSuggestions.style.display = 'none';
  addMapSuggestions.setAttribute('role', 'listbox');

  var addMapViewportHint = document.createElement('div');
  addMapViewportHint.className = 'openmaps-add-map-viewport-hint';
  addMapViewportHint.setAttribute('aria-live', 'polite');

  addMapContainer.appendChild(addMapInput);
  addMapContainer.appendChild(addMapSuggestions);
  addMapContainer.appendChild(addMapViewportHint);

  var addMapsHeader = document.createElement('div');
  addMapsHeader.className = 'openmaps-add-maps-header';
  var addMapsTitle = document.createElement('h4');
  addMapsTitle.textContent = I18n.t('openmaps.maps_to_add_title');
  addMapsHeader.appendChild(addMapsTitle);
  var addMapsFilterMode = document.createElement('select');
  addMapsFilterMode.className = 'form-control openmaps-add-maps-mode-select';
  addMapsFilterMode.setAttribute('aria-label', I18n.t('openmaps.add_maps_filter_mode_aria'));
  [
    { v: 'all', t: I18n.t('openmaps.active_maps_filter_all') },
    { v: 'in_view', t: I18n.t('openmaps.active_maps_filter_in_view') }
  ].forEach(function(o) {
    var opt = document.createElement('option');
    opt.value = o.v;
    opt.textContent = o.t;
    addMapsFilterMode.appendChild(opt);
  });
  addMapsHeader.appendChild(addMapsFilterMode);
  addMapsFilterMode.addEventListener('change', function() {
    if (addMapSuggestions.style.display === 'block') {
      populateAddMapSuggestions(addMapInput.value);
    }
  });

  tab.appendChild(addMapsHeader);
  tab.appendChild(addMapContainer);

  var userMapsSection = document.createElement('div');
  userMapsSection.className = 'openmaps-user-maps-section';
  userMapsSection.style.marginBottom = '16px';
  var userMapsTitleEl = document.createElement('h4');
  userMapsTitleEl.style.cssText = 'margin:0 0 8px 0;font-size:1.15em;font-weight:bold;';
  userMapsTitleEl.textContent = I18n.t('openmaps.user_maps_section_title');
  var userMapsRow = document.createElement('div');
  userMapsRow.style.cssText = 'display:flex;gap:6px;align-items:stretch;flex-wrap:wrap;';
  var userMapsInput = document.createElement('input');
  userMapsInput.type = 'text';
  userMapsInput.className = 'form-control openmaps-user-maps-input';
  userMapsInput.placeholder = I18n.t('openmaps.user_maps_add_placeholder');
  userMapsInput.style.cssText = 'flex:1 1 160px;min-width:120px;';
  userMapsInput.setAttribute('autocomplete', 'off');
  var userMapsBtn = document.createElement('wz-button');
  userMapsBtn.setAttribute('size', 'sm');
  userMapsBtn.setAttribute('color', 'primary');
  userMapsBtn.className = 'openmaps-wz-btn-compact';
  userMapsBtn.textContent = I18n.t('openmaps.user_maps_add_button');
  var userMapsMsg = document.createElement('div');
  userMapsMsg.className = 'openmaps-user-maps-msg';
  userMapsMsg.style.cssText = 'display:none;font-size:11px;color:#c5221f;margin-top:6px;line-height:1.35;';
  var userMapsHintEl = document.createElement('div');
  userMapsHintEl.className = 'openmaps-user-maps-hint';
  userMapsHintEl.style.cssText = 'font-size:11px;color:#70757a;margin-top:6px;line-height:1.35;';
  userMapsHintEl.textContent = I18n.t('openmaps.user_maps_hint');

  function showUserMapsMsg(t) {
    userMapsMsg.textContent = t || '';
    userMapsMsg.style.display = t ? 'block' : 'none';
  }

  function tryAddGoogleMyMap() {
    showUserMapsMsg('');
    var parsedAdd = openMapsParseGoogleMyMapsInput(userMapsInput.value);
    if (!parsedAdd) {
      showUserMapsMsg(I18n.t('openmaps.user_maps_add_invalid'));
      return;
    }
    var sAdd = Settings.get();
    if (!Array.isArray(sAdd.state.userMaps)) sAdd.state.userMaps = [];
    if (sAdd.state.userMaps.some(function(m) { return m && m.type === 'GOOGLE_MY_MAPS' && m.mid === parsedAdd.mid; })) {
      showUserMapsMsg(I18n.t('openmaps.user_maps_add_duplicate'));
      return;
    }
    var idNew = openMapsNewUserMapId();
    var defNew = {
      id: idNew,
      title: I18n.t('openmaps.user_maps_default_title'),
      source: 'user',
      touId: 'google-mymaps',
      area: 'user',
      type: 'GOOGLE_MY_MAPS',
      crs: 'EPSG:3857',
      url: parsedAdd.kmlUrl,
      mid: parsedAdd.mid,
      originalUrl: parsedAdd.originalUrl,
      bbox: [-180, -85, 180, 85],
      queryable: false,
      layers: {
        main: { title: 'KML', abstract: '', queryable: false }
      },
      default_layers: ['main'],
      attribution: 'Google My Maps'
    };
    sAdd.state.userMaps.push(defNew);
    maps.set(defNew.id, defNew);
    Settings.put(sAdd);
    userMapsInput.value = '';
    selectMapToAdd(String(defNew.id));
    if (addMapSuggestions.style.display === 'block') populateAddMapSuggestions(addMapInput.value);
  }

  userMapsBtn.addEventListener('click', function(evU) {
    if (evU) evU.preventDefault();
    tryAddGoogleMyMap();
  });
  userMapsInput.addEventListener('keydown', function(evK) {
    if (evK.key === 'Enter') {
      evK.preventDefault();
      tryAddGoogleMyMap();
    }
  });

  userMapsRow.appendChild(userMapsInput);
  userMapsRow.appendChild(userMapsBtn);
  userMapsSection.appendChild(userMapsTitleEl);
  userMapsSection.appendChild(userMapsRow);
  userMapsSection.appendChild(userMapsMsg);
  userMapsSection.appendChild(userMapsHintEl);
  tab.appendChild(userMapsSection);

  var addMapSuggestionsBlurTimer = null;
  var addMapSuggestionsPositionListenersOn = false;
  function positionAddMapSuggestions() {
    if (addMapSuggestions.style.display !== 'block') return;
    var r = addMapInput.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    var gap = 2;
    var top = r.bottom + gap;
    var left = r.left;
    var width = Math.max(160, r.width);
    var vv = window.visualViewport;
    var bottomEdge = vv ? vv.offsetTop + vv.height : window.innerHeight;
    var avail = bottomEdge - top - 12;
    var maxH = Math.max(120, Math.min(560, avail));
    addMapSuggestions.style.position = 'fixed';
    addMapSuggestions.style.left = left + 'px';
    addMapSuggestions.style.top = top + 'px';
    addMapSuggestions.style.width = width + 'px';
    addMapSuggestions.style.maxHeight = maxH + 'px';
    addMapSuggestions.style.right = 'auto';
    addMapSuggestions.style.marginTop = '0';
    addMapSuggestions.style.boxSizing = 'border-box';
    addMapSuggestions.style.zIndex = '100550';
  }
  function syncAddMapSuggestionsPositionListeners() {
    if (addMapSuggestions.style.display === 'block') {
      if (!addMapSuggestionsPositionListenersOn) {
        window.addEventListener('scroll', positionAddMapSuggestions, true);
        window.addEventListener('resize', positionAddMapSuggestions);
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', positionAddMapSuggestions);
          window.visualViewport.addEventListener('scroll', positionAddMapSuggestions);
        }
        addMapSuggestionsPositionListenersOn = true;
      }
    } else if (addMapSuggestionsPositionListenersOn) {
      window.removeEventListener('scroll', positionAddMapSuggestions, true);
      window.removeEventListener('resize', positionAddMapSuggestions);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', positionAddMapSuggestions);
        window.visualViewport.removeEventListener('scroll', positionAddMapSuggestions);
      }
      addMapSuggestionsPositionListenersOn = false;
    }
  }
  function hideAddMapSuggestions() {
    addMapSuggestions.style.display = 'none';
    syncAddMapSuggestionsPositionListeners();
  }
  function showAddMapSuggestions() {
    addMapSuggestions.style.display = 'block';
    populateAddMapSuggestions(addMapInput.value);
    positionAddMapSuggestions();
    syncAddMapSuggestionsPositionListeners();
  }

  addMapSuggestions.addEventListener('mousedown', function(e) {
    if (addMapSuggestionsBlurTimer) {
      clearTimeout(addMapSuggestionsBlurTimer);
      addMapSuggestionsBlurTimer = null;
    }
    e.preventDefault();
  });

  addMapInput.addEventListener('focus', function() {
    if (addMapSuggestionsBlurTimer) {
      clearTimeout(addMapSuggestionsBlurTimer);
      addMapSuggestionsBlurTimer = null;
    }
    showAddMapSuggestions();
  });

  addMapInput.addEventListener('blur', function() {
    addMapSuggestionsBlurTimer = setTimeout(hideAddMapSuggestions, 200);
  });

  addMapInput.addEventListener('input', function() {
    showAddMapSuggestions();
  });

  addMapInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      hideAddMapSuggestions();
      addMapInput.blur();
    }
  });

  // --- RESTORED: Tell the script to update the list when the map loads and moves! ---
  updateMapSelector();
  if (openMapsWmeSdk && openMapsWmeSdk.Events && typeof openMapsWmeSdk.Events.on === 'function') {
    try {
      openMapsWmeSdk.Events.on({ eventName: 'wme-map-move-end', eventHandler: updateMapSelector });
      openMapsWmeSdk.Events.on({ eventName: 'wme-map-zoom-changed', eventHandler: updateMapSelector });
    } catch (eMapSel) {
      W.map.events.register('moveend', null, updateMapSelector);
    }
  } else {
    W.map.events.register('moveend', null, updateMapSelector);
  }
  // ----------------------------------------------------------------------------------
  // --------------------------------------

  try {
    document.documentElement.classList.remove('openmaps-unlock-wme-sidebar');
    var omUnlockStyle = document.getElementById('openmaps-wme-sidebar-unlock-style');
    if (omUnlockStyle && omUnlockStyle.parentNode) omUnlockStyle.parentNode.removeChild(omUnlockStyle);
  } catch (eOmUnlock) {}

  var footer = document.createElement('div');
  footer.className = 'openmaps-sidebar-footer';
  var footerVersion = document.createElement('span');
  footerVersion.className = 'openmaps-sidebar-footer-version';
  try {
    footerVersion.textContent = GM_info.script.name + ': v' + GM_info.script.version;
  } catch (e) {
    // Probably no support for GM_info, ignore
  }
  var hideTooltips = document.createElement('wz-button');
  hideTooltips.setAttribute('size', 'sm');
  hideTooltips.setAttribute('color', 'secondary');
  hideTooltips.textContent = (Settings.get().tooltips ? I18n.t('openmaps.hide_tooltips') : I18n.t('openmaps.show_tooltips'));
  hideTooltips.className = 'openmaps-sidebar-footer-help openmaps-wz-btn-compact';
  hideTooltips.addEventListener('click', function(ev) {
    ev.preventDefault();
    Tooltips.toggle();
    hideTooltips.textContent = (Settings.get().tooltips ? I18n.t('openmaps.hide_tooltips') : I18n.t('openmaps.show_tooltips'));
  });
  footer.appendChild(footerVersion);
  footer.appendChild(hideTooltips);
  tab.appendChild(footer);

  var resetTermsGlobalBox = document.createElement('div');
  resetTermsGlobalBox.className = 'open-maps-reset-all-terms-global';
  resetTermsGlobalBox.style.cssText = 'margin-top: 14px; padding-top: 12px; border-top: 1px dotted #ccc;';
  var resetTermsGlobalBtn = document.createElement('wz-button');
  resetTermsGlobalBtn.className = 'openmaps-wz-btn-compact';
  resetTermsGlobalBtn.setAttribute('color', 'secondary');
  resetTermsGlobalBtn.setAttribute('size', 'sm');
  resetTermsGlobalBtn.style.cssText = 'width:100%; text-align:left;';
  resetTermsGlobalBtn.innerHTML = '<i class="fa fa-history" aria-hidden="true"></i> ' + I18n.t('openmaps.reset_terms_button');
  resetTermsGlobalBtn.addEventListener('click', function() {
    if (confirm(I18n.t('openmaps.reset_terms_confirm'))) {
      var s = Settings.get();
      s.state.acceptedToUs = {};
      Settings.put(s);
      location.reload();
    }
  });
  resetTermsGlobalBox.appendChild(resetTermsGlobalBtn);
  tab.appendChild(resetTermsGlobalBox);

  //#endregion

  //#region Implement map query support
  // Add the control to catch a click on the map area for retrieving map information
  var lastQueryInspectorPayload = null;
  var queryWindowContent, queryWindowOriginalContent;
  var queryWindow = document.createElement('div');
  queryWindow.className = 'open-maps-query-window';
  queryWindow.addEventListener('click', function(e) {
    e.stopPropagation();
  });
  var styleObserver = new MutationObserver(function() {
    if (queryWindow.style.height != '') {
      Settings.set('queryWindowHeight', queryWindow.style.height);
    }
  });
  styleObserver.observe(queryWindow, { attributes: true, attributeFilter: ['style'] });
  var mapObserver = new MutationObserver(function() {
    if (document.getElementById('map').classList.contains('lightboxShown')) {
      queryWindow.style.top = '';
      queryWindow.style.bottom = '35px';
    } else {
      queryWindow.style.top = '40px';
      queryWindow.style.bottom = '';
    }
  });
  mapObserver.observe(document.getElementById('map'), { attributes: true, attributeFilter: ['class'] });
  var queryWindowSwitch = document.createElement('wz-button');
  queryWindowSwitch.setAttribute('color', 'clear-icon');
  queryWindowSwitch.setAttribute('size', 'sm');
  queryWindowSwitch.className = 'open-maps-query-window-button-left open-maps-query-window-toolbar-wz';
  queryWindowSwitch.innerHTML = '<i class="fa fa-fw fa-retweet" aria-hidden="true"></i>';
  queryWindowSwitch.dataset.placement = 'right';
  queryWindowSwitch.setAttribute('aria-label', I18n.t('openmaps.query_window_switch'));
  queryWindowSwitch.title = I18n.t('openmaps.query_window_switch');
  Tooltips.add(queryWindowSwitch, I18n.t('openmaps.query_window_switch'));
  queryWindowSwitch.addEventListener('click', function() {
    queryWindowOriginalContent.classList.toggle('hidden');
    queryWindowContent.classList.toggle('hidden');
    var settings = Settings.get();
    settings.queryWindowDisplay = (settings.queryWindowDisplay == undefined || settings.queryWindowDisplay == 'processed' ? 'original': 'processed' );
    Settings.put(settings);
  });
  queryWindow.appendChild(queryWindowSwitch);
  var queryWindowQuery = document.createElement('wz-button');
  queryWindowQuery.setAttribute('color', 'clear-icon');
  queryWindowQuery.setAttribute('size', 'sm');
  queryWindowQuery.className = 'open-maps-query-window-button-left open-maps-query-window-toolbar-wz';
  queryWindowQuery.innerHTML = '<i class="fa fa-fw fa-hand-pointer-o" aria-hidden="true"></i>';
  queryWindowQuery.dataset.placement = 'right';
  queryWindowQuery.setAttribute('aria-label', I18n.t('openmaps.query_window_query'));
  queryWindowQuery.title = I18n.t('openmaps.query_window_query');
  Tooltips.add(queryWindowQuery, I18n.t('openmaps.query_window_query'));
  queryWindowQuery.addEventListener('click', function() {
    var qIcon = queryWindowQuery.querySelector('i');
    if (!getFeatureInfoControl.active) {
      if (getFeatureInfoControl.params) {
        if (qIcon) qIcon.style.color = 'blue';
        getFeatureInfoControl.params.callback = function() {
          if (qIcon) qIcon.style.color = '';
        };
        getFeatureInfoControl.activate();
      } else {
        log('Could not find previous query parameters, weird.');
      }
    } else {
      getFeatureInfoControl.deactivate();
    }
  });
  queryWindow.appendChild(queryWindowQuery);
  var queryWindowInspector = document.createElement('wz-button');
  queryWindowInspector.setAttribute('color', 'clear-icon');
  queryWindowInspector.setAttribute('size', 'sm');
  queryWindowInspector.className = 'open-maps-query-window-button-left open-maps-query-window-toolbar-wz';
  queryWindowInspector.innerHTML = '<i class="fa fa-fw fa-list-alt" aria-hidden="true"></i>';
  queryWindowInspector.dataset.placement = 'right';
  queryWindowInspector.setAttribute('aria-label', I18n.t('openmaps.inspector_query_add_btn'));
  queryWindowInspector.title = I18n.t('openmaps.inspector_query_add_btn_tooltip');
  Tooltips.add(queryWindowInspector, I18n.t('openmaps.inspector_query_add_btn_tooltip'));
  queryWindowInspector.addEventListener('click', function() {
    if (!openMapsInspectorApi || !lastQueryInspectorPayload) return;
    var p = lastQueryInspectorPayload;
    if (p.type === 'esri') openMapsInspectorApi.ingestEsriResults(p.json, p.mapId, p.layersStr);
    else if (p.type === 'wms') openMapsInspectorApi.ingestWmsFromContent(p.contentEl, p.mapId, p.layersStr);
  });
  queryWindow.appendChild(queryWindowInspector);
  var queryWindowClose = document.createElement('wz-button');
  queryWindowClose.setAttribute('color', 'clear-icon');
  queryWindowClose.setAttribute('size', 'sm');
  queryWindowClose.className = 'open-maps-query-window-button-right open-maps-query-window-toolbar-wz';
  queryWindowClose.innerHTML = '<i class="fa fa-fw fa-window-close" aria-hidden="true"></i>';
  queryWindowClose.setAttribute('aria-label', I18n.t('openmaps.query_window_close'));
  queryWindowClose.title = I18n.t('openmaps.query_window_close');
  queryWindowClose.addEventListener('click', function() {
    queryWindow.style.display = 'none';
  });
  queryWindow.appendChild(queryWindowClose);
  var queryWindowMinimize = document.createElement('wz-button');
  queryWindowMinimize.setAttribute('color', 'clear-icon');
  queryWindowMinimize.setAttribute('size', 'sm');
  queryWindowMinimize.className = 'open-maps-query-window-button-right open-maps-query-window-toolbar-wz';
  queryWindowMinimize.innerHTML = '<i class="fa fa-fw fa-toggle-up" aria-hidden="true"></i>';
  queryWindowMinimize.setAttribute('aria-label', I18n.t('openmaps.query_window_minimize'));
  queryWindowMinimize.title = I18n.t('openmaps.query_window_minimize');
  queryWindowMinimize.addEventListener('click', function() {
    var isMinimized = queryWindow.style.height != '';
    queryWindow.style.height = (isMinimized ? '' : Settings.get().queryWindowHeight || '185px');
    queryWindow.style.resize = (isMinimized ? 'none' : 'vertical');
    var qmIcon = queryWindowMinimize.querySelector('i');
    if (qmIcon) {
      qmIcon.classList.toggle('fa-toggle-up', isMinimized);
      qmIcon.classList.toggle('fa-toggle-down', !isMinimized);
    }
  });
  queryWindow.appendChild(queryWindowMinimize);
  var queryWindowTitle = document.createElement('h2');
  queryWindowTitle.textContent = I18n.t('openmaps.query_window_title');
  queryWindow.appendChild(queryWindowTitle);
  var queryWindowLoading = document.createElement('p');
  queryWindowLoading.style.textAlign = 'center';
  queryWindowLoading.style.fontSize = '21px';
  var queryWindowLoadingSpinner = document.createElement('span');
  queryWindowLoadingSpinner.className = 'fa fa-spinner fa-pulse';
  queryWindowLoading.appendChild(queryWindowLoadingSpinner);
  queryWindowLoading.appendChild(document.createTextNode(' ' + I18n.t('openmaps.query_window_loading')));
  queryWindow.appendChild(queryWindowLoading);
  queryWindowContent = document.createElement('div');
  queryWindowContent.style.fontSize = '14px';
  var queryWindowDisplay = Settings.get().queryWindowDisplay;
  queryWindowContent.classList.toggle('hidden', queryWindowDisplay == 'original');
  queryWindow.appendChild(queryWindowContent);
  queryWindowOriginalContent = document.createElement('div');
  queryWindowOriginalContent.style.fontSize = '14px';
  queryWindowOriginalContent.className = 'hidden';
  queryWindowOriginalContent.classList.toggle('hidden', queryWindowDisplay != 'original');
  queryWindow.appendChild(queryWindowOriginalContent);
  document.getElementById('WazeMap').appendChild(queryWindow);
  var querySymbol = document.createElement('span');
  querySymbol.className = 'fa fa-exclamation-triangle fa-4x';
  querySymbol.style.float = 'left';
  querySymbol.style.margin = '0 15px 30px';
  var getFeatureInfoControl = new OpenLayers.Control({
    id: 'GetFeatureInfoControl',
    eventListeners: {
      'activate': function() {
        document.getElementById('WazeMap').style.cursor = 'help';
      },
      'deactivate': function() {
        document.getElementById('WazeMap').style.cursor = '';
      }
    }
  });
  W.map.addControl(getFeatureInfoControl);
  var clickHandler = new OpenLayers.Handler.Click(getFeatureInfoControl, {
    'click': function(e) {
      getFeatureInfoControl.deactivate();
      getFeatureInfoControl.params.callback();
      lastQueryInspectorPayload = null;
      var mapId = getFeatureInfoControl.params?.id;
      var queriedMap = mapId ? maps.get(mapId) : null;
      var isEsri = queriedMap && queriedMap.type === 'ESRI';
      var isEsriFeature = queriedMap && queriedMap.type === 'ESRI_FEATURE';
      var queryUrl = '';
      if (isEsri || isEsriFeature) {
        // ArcGIS REST Identify (MapServer)
        var olMap = (W && W.map && typeof W.map.getOLMap === 'function') ? W.map.getOLMap() : null;
        var ll = null;
        try {
          if (olMap && typeof olMap.getLonLatFromPixel === 'function') ll = olMap.getLonLatFromPixel(e.xy);
          else if (olMap && typeof olMap.getLonLatFromViewPortPx === 'function') ll = olMap.getLonLatFromViewPortPx(e.xy);
        } catch (err) {
          ll = null;
        }
        var x = ll ? ll.lon : null;
        var y = ll ? ll.lat : null;
        if (isEsriFeature) {
          // ArcGIS FeatureServer point/line/polygon query around click
          // Distance is in meters for WebMercator when units=esriSRUnit_Meter.
          var base = String(getFeatureInfoControl.params.url || '').replace(/\/+$/, '');
          queryUrl =
            base +
            '/query?f=json&where=' + encodeURIComponent('1=1') +
            '&geometry=' + encodeURIComponent(String(x) + ',' + String(y)) +
            '&geometryType=esriGeometryPoint&inSR=3857&outSR=3857' +
            '&spatialRel=esriSpatialRelIntersects&distance=25&units=esriSRUnit_Meter' +
            '&returnGeometry=false&outFields=*' +
            '&resultRecordCount=25';
        } else {
          var extent = getMapExtent();
          var sz = W.map.getSize();
          var identifyLayers = getFeatureInfoControl.params.layers || '';
          // Identify expects `layers=all:<ids>` (or omit for all). Filter to numeric layer ids only.
          var esriIds = String(identifyLayers || '')
            .split(',')
            .map(s => String(s).trim())
            .filter(s => s && /^-?\d+$/.test(s));
          var layersParam = esriIds.length ? ('layers=all:' + esriIds.join(',')) : 'layers=all';
          queryUrl =
            getFeatureInfoControl.params.url.replace(/\/+$/, '') +
            '/identify?f=json&geometry=' + encodeURIComponent(String(x) + ',' + String(y)) +
            '&geometryType=esriGeometryPoint&sr=3857' +
            '&tolerance=6&returnGeometry=false' +
            '&mapExtent=' + encodeURIComponent(extent.toBBOX()) +
            '&imageDisplay=' + encodeURIComponent(String(sz.w) + ',' + String(sz.h) + ',96') +
            '&' + layersParam;
        }
      } else {
        // WMS GetFeatureInfo
        queryUrl = getFeatureInfoControl.params.url + '?SERVICE=WMS&REQUEST=GetFeatureInfo&STYLES=&BBOX=' + getMapExtent().toBBOX() +
          '&LAYERS=' + getFeatureInfoControl.params.layers + '&QUERY_LAYERS=' + getFeatureInfoControl.params.layers +
          '&HEIGHT=' + W.map.getSize().h + '&WIDTH=' + W.map.getSize().w +
          // FIX: Added FEATURE_COUNT=50 to force the server to return multiple overlapping layers/objects!
          '&VERSION=1.3.0&CRS=EPSG:3857&I=' + e.xy.x + '&J=' + e.xy.y + '&FEATURE_COUNT=50&INFO_FORMAT=text/html';
      }
      // --- MODERNIZED DYNAMIC TITLE ---
          // Uses Optional Chaining to prevent null crashes and Template Literals for the string
          queryWindowTitle.textContent = queriedMap ? I18n.t('openmaps.query_results_for').replace(/\{title\}/g, queriedMap.title) : I18n.t('openmaps.query_window_title');
      // --------------------------------
      queryWindowLoading.style.display = 'block';
      while (queryWindowContent.firstChild) {
        queryWindowContent.removeChild(queryWindowContent.firstChild);
      }
      while (queryWindowOriginalContent.firstChild) {
        queryWindowOriginalContent.removeChild(queryWindowOriginalContent.firstChild);
      }
      queryWindow.style.display = 'block';
      GM_xmlhttpRequest({
        method: 'GET',
        headers: {
          Accept: (isEsri || isEsriFeature) ? 'application/json' : 'text/xml'
        },
        url: queryUrl,
        timeout: 10000,
        onload: function(response) {
          queryWindowLoading.style.display = 'none';
          if (response.status == 200) {
            if (isEsri || isEsriFeature) {
              var json = null;
              try {
                json = JSON.parse(response.responseText || '{}');
              } catch (err) {
                json = null;
              }

              // Original
              var pre = document.createElement('pre');
              pre.style.whiteSpace = 'pre-wrap';
              pre.textContent = json ? JSON.stringify(json, null, 2) : (response.responseText || '');
              queryWindowOriginalContent.appendChild(pre);

              // Processed: results → table
              var results = [];
              if (isEsriFeature) {
                var feats = (json && Array.isArray(json.features)) ? json.features : [];
                results = feats.map(function(f) {
                  return {
                    layerName: queriedMap?.title || 'FeatureServer',
                    value: (f && f.attributes) ? (f.attributes.name || f.attributes.title || f.attributes.NAME || '') : '',
                    attributes: (f && f.attributes) ? f.attributes : {}
                  };
                });
              } else {
                results = (json && Array.isArray(json.results)) ? json.results : [];
              }
              if (!results.length) {
                querySymbol.style.color = '#999';
                queryWindowContent.appendChild(querySymbol);
                var emptyResponse = document.createElement('p');
                emptyResponse.textContent = I18n.t('openmaps.query_empty_response');
                queryWindowContent.appendChild(emptyResponse);
              } else {
                results.forEach(function(r, idx) {
                  var h = document.createElement('h3');
                  h.style.margin = '8px 0 6px';
                  h.style.fontSize = '15px';
                  h.textContent = (r.layerName ? r.layerName : 'Result') + (r.value ? (' — ' + r.value) : '') + (results.length > 1 ? (' (#' + (idx + 1) + ')') : '');
                  queryWindowContent.appendChild(h);

                  var attrs = r && r.attributes && typeof r.attributes === 'object' ? r.attributes : {};
                  var keys = Object.keys(attrs);
                  if (!keys.length) return;
                  var table = document.createElement('table');
                  table.border = '1';
                  table.style.borderCollapse = 'collapse';
                  table.style.width = '100%';
                  keys.forEach(function(k) {
                    var tr = document.createElement('tr');
                    var tdK = document.createElement('td');
                    tdK.style.fontWeight = '600';
                    tdK.style.padding = '4px 6px';
                    tdK.textContent = k;
                    var tdV = document.createElement('td');
                    tdV.style.padding = '4px 6px';
                    tdV.textContent = String(attrs[k]);
                    tr.appendChild(tdK);
                    tr.appendChild(tdV);
                    table.appendChild(tr);
                  });
                  queryWindowContent.appendChild(table);
                });
                lastQueryInspectorPayload = {
                  type: isEsriFeature ? 'esri_feature' : 'esri',
                  json: json,
                  mapId: mapId,
                  layersStr: getFeatureInfoControl.params.layers || ''
                };
                if (openMapsInspectorApi) {
                  if (!isEsriFeature) {
                    openMapsInspectorApi.maybeAutoIngest(true, {
                      json: json,
                      mapId: mapId,
                      layersStr: getFeatureInfoControl.params.layers || ''
                    });
                  }
                }
              }
            } else {
              if (!response.responseXML) {
                response.responseXML = new DOMParser().parseFromString(response.responseText, "text/xml");
              }
              // While probably not 100% waterproof, at least this should counter most XSS vectors
              var unwantedNodes = response.responseXML.querySelectorAll('javascript,iframe,frameset,applet,embed,object,style');
              for (let i = 0; i < unwantedNodes.length; i++) {
                unwantedNodes[i].parentNode.removeChild(unwantedNodes[i]);
              }
              var body = response.responseXML.querySelector('body');
              var content = body ? body.textContent.trim() : '';
              if (body && content.length != 0) {
                  removeUnsafeAttributes(body);
                    queryWindowOriginalContent.innerHTML = body.innerHTML;
                    setBorders(queryWindowOriginalContent)
                    queryWindowContent.innerHTML = body.innerHTML;
                    var qfs = maps.get(mapId)?.query_filters;
                    if (Array.isArray(qfs)) {
                      qfs.forEach((func) => {
                        func(queryWindowContent, maps.get(mapId));
                      });
                    }

             // --- COMPACT URL COPIER FOR QUERY WINDOW ---
                  // Generates two compact copiers using the universal engine
                  var copier1 = createClipboardCopier('Exact URL:', queryUrl, true);
                  var copier2 = createClipboardCopier('Exact URL:', queryUrl, true);

                  // Insert at the top of BOTH the Processed and Original data views!
                  queryWindowContent.insertBefore(copier1, queryWindowContent.firstChild);
                  queryWindowOriginalContent.insertBefore(copier2, queryWindowOriginalContent.firstChild);
                  // -------------------------------------------

                  lastQueryInspectorPayload = {
                    type: 'wms',
                    contentEl: queryWindowContent,
                    mapId: mapId,
                    layersStr: getFeatureInfoControl.params.layers || ''
                  };
                  if (openMapsInspectorApi) {
                    openMapsInspectorApi.maybeAutoIngest(false, {
                      contentEl: queryWindowContent,
                      mapId: mapId,
                      layersStr: getFeatureInfoControl.params.layers || ''
                    });
                  }

                  queryWindow.style.display = 'block';
              var escHandler = function(e) {
                if (e.keyCode == 27) { // Esc key
                  if (queryWindow.style.display == 'block') {
                    queryWindow.style.display = 'none';
                    e.stopPropagation();
                  }
                  document.removeEventListener('keydown', escHandler);
                }
              };
              document.addEventListener('keydown', escHandler);
            } else {
              querySymbol.style.color = '#999';
              queryWindowContent.appendChild(querySymbol);
              var emptyResponse = document.createElement('p');
              emptyResponse.textContent = I18n.t('openmaps.query_empty_response');
              queryWindowContent.appendChild(emptyResponse);
              var emptyResponseAdvice = document.createElement('p');
              emptyResponseAdvice.innerHTML = I18n.t('openmaps.query_empty_response_advice').replace("{hotkey}", "<kbd>" + (/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform) ? "Cmd" : "Ctrl") + "+0</kbd>");
              queryWindowContent.appendChild(emptyResponseAdvice);
            }
            }
          } else {
            log(response);
            querySymbol.style.color = 'red';
            queryWindowContent.appendChild(querySymbol);
            var errorResponseTitle = document.createElement('p');
            errorResponseTitle.textContent = I18n.t('openmaps.errors.network');
            queryWindowContent.appendChild(errorResponseTitle);
            var errorResponse = document.createElement('p');
            errorResponse.textContent = I18n.t('openmaps.errors.network_description') + (response.statusText ? response.statusText : '<empty>') + ' (' + response.status + ')';
            queryWindowContent.appendChild(errorResponse);
          }
        },
        ontimeout: function(e) {
          log(e);
          queryWindowLoading.style.display = 'none';
          querySymbol.style.color = 'orange';
          queryWindowContent.appendChild(querySymbol);
          var timeoutResponse = document.createElement('p');
          timeoutResponse.textContent = I18n.t('openmaps.errors.timeout_description');
          queryWindowContent.appendChild(timeoutResponse);
        },
        onerror: function(e) {
          log(e);
          queryWindowLoading.style.display = 'none';
          querySymbol.style.color = 'red';
          queryWindowContent.appendChild(querySymbol);
          var errorResponseTitle = document.createElement('p');
          errorResponseTitle.textContent = I18n.t('openmaps.errors.network');
          queryWindowContent.appendChild(errorResponseTitle);
          var errorResponse = document.createElement('p');
          errorResponse.textContent = I18n.t('openmaps.errors.see_console');
          queryWindowContent.appendChild(errorResponse);
        }
      });
    }
  });
  getFeatureInfoControl.handler = clickHandler;

  function removeUnsafeAttributes(node) {
    if (node.nodeType == Node.ELEMENT_NODE) {
      for (let i = 0; i < node.attributes.length; i++) {
        var attrName = node.attributes[i].name.toLowerCase();
        if (attrName.startsWith('on') || attrName == 'style' || attrName == 'class' || (attrName == 'href' && node.attributes[i].value.trim().toLowerCase().startsWith('javascript:'))) {
          node.removeAttribute(attrName);
        }
      }
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      removeUnsafeAttributes(node.childNodes[i]);
    }
  }

  function setBorders(body) {
    var tables = body.querySelectorAll('table');
    for (let i = 0; i < tables.length; i++) {
      tables[i].border = '1';
    }
  }

  // Turn the columns of the table into rows to make the table go from horizontal to vertical
  function transposeTables(body) {
    var tables = body.querySelectorAll('table');
    for (let i = 0; i < tables.length; i++) {
      var newTable = transposeTable(tables[i]);
      tables[i].parentNode.insertBefore(newTable, tables[i]);
      tables[i].parentNode.removeChild(tables[i]);
    }
    function transposeTable(table) {
      var newTable = document.createElement('table');
      newTable.className = 'table table-striped table-hover table-condensed';
      var caption = table.querySelector('caption');
      if (caption) {
        var header = document.createElement('h5');
        header.textContent = caption.textContent;
        table.parentNode.insertBefore(header, table);
        table.removeChild(caption);
      }
      var tableHead = document.createElement('thead');
      var tableHeadRow = document.createElement('tr');
      var propertyHead = document.createElement('th');
      propertyHead.textContent = I18n.t('openmaps.query_table_property');
      tableHeadRow.appendChild(propertyHead);
      var valueHead = document.createElement('th');
      valueHead.textContent = I18n.t('openmaps.query_table_value');
      tableHeadRow.appendChild(valueHead);
      tableHead.appendChild(tableHeadRow);
      newTable.appendChild(tableHead);
      var tableBody = document.createElement('tbody');
      var firstRow = table.querySelector('tr');
      for (let i = 0; i < firstRow.childNodes.length; i++) {
        if (firstRow.childNodes[i].nodeType == 1) { // Element nodes only
          tableBody.appendChild(document.createElement('tr'));
        }
      }
      var rows = table.querySelectorAll('tr');
      for (let i = 0; i < rows.length; i++) {
        distributeColumnsOverRows(rows[i].childNodes, tableBody);
      }
      newTable.appendChild(tableBody);
      return newTable;
    }
    function distributeColumnsOverRows(columns, tbody) {
      var skippedCols = 0;
      for (let i = 0; i < columns.length; i++) {
        if (columns[i].nodeType == 1) { // Element nodes only
          var cell = document.createElement('td');
          cell.textContent = columns[i].textContent;
          tbody.childNodes[i - skippedCols].appendChild(cell);
        } else {
          skippedCols++;
        }
      }
    }
  }

  // Remove table rows with an empty or null value
  function cleanTableRows(body) {
    var rows = body.querySelectorAll('table tr');
    for (let i = 0; i < rows.length; i++) {
      cleanRow(rows[i]);
    }
    function cleanRow(row) {
      var rowProperty = row.childNodes[0];
      if (rowProperty.textContent.indexOf('_') != -1) {
        rowProperty.textContent = rowProperty.textContent.replace(/_/g, ' ').replace(/  /g, ' ').trim();
      }
      var rowContent = row.childNodes[1].textContent.trim();
      if (rowContent == '' || rowContent.toLowerCase() == 'null') {
        row.parentNode.removeChild(row);
      }
    }
  }

  // Put certain rows at first place as they are more important
  function reorderTableRows(body, map) {
    var propertyOrder = {
      '3101': [ 'openbare ruimte', 'huisnummer', 'huisletter', 'woonplaats' ],
      '3105': [ 'sttNaam', 'gmeNaam', 'wegnummer' ],
      '3108': [ 'maxshd', 'betrwbheid', 'stt naam' ],
      '3202': [ 'OpnDatum' ],
      '3206': [ 'OpnDatum' ],
      '3207': [ 'linksStraatnaam', 'rechtsStraatnaam', 'lblMorfologie', 'lblBeheerder', 'lblOrganisatie' ],
      '3208': [ 'NAAM' ],
      '3209': [ 'OpnDatum' ],
      '3211': [ 'OpnDatum' ],
      '3212': [ 'Snelheidsbeperking', 'Variabel bord' ],
      '3217': [ 'NOM ROUTE', 'NUMERO ROUTE', 'TYPE DESC', 'SOUS TYPE DESC' ],
      '3220': [ 'bordcode' ],
      '3221': [ 'Snelheid' ],
      '3237': [ 'VolledigAdres', 'AdresStatus' ],
      '3238': [ 'HindranceDescription', 'HindranceStart', 'HindranceEnd', 'HindranceStatus', 'Consequences' ],
      '3239': [ 'HindranceDescription', 'HindranceStart', 'HindranceEnd', 'HindranceStatus', 'Consequences' ],
      '5501': [ 'COMPLETO' ]
    };
    if (!propertyOrder[map.id]) {
      return;
    }
    var rows = body.querySelectorAll('table tr');
    var priorityRows = [];
    for (var i = 0; i < rows.length; i++) {
      var location = propertyOrder[map.id].indexOf(rows[i].firstChild.textContent);
      if (location > -1) {
        priorityRows[location] = rows[i];
      }
    }
    priorityRows.reverse().forEach(function(priorityRow) {
      priorityRow.parentNode.insertBefore(priorityRow, priorityRow.parentNode.firstChild);
    });
  }

// Turn links within table cells into anchors (Upgraded for ASIG squished text bugs)
  function transformUrlsToLinks(body) {
    var cells = body.querySelectorAll('tr td, tr th');
    // Match valid URL strings but safely stop before random trailing text
    var urlRegex = /(https?:\/\/[a-zA-Z0-9\-\.\/\?&_=%]+)/g;

    for (var i = 0; i < cells.length; i++) {
      if (cells[i].children.length === 0 && urlRegex.test(cells[i].textContent)) {
        var originalText = cells[i].textContent;

        // FIX: ASIG's table misses a space between the .jpg and the timestamp (e.g. .jpg2022:07).
        // This adds a space so the link parser doesn't break!
        var cleanedText = originalText.replace(/(\.jpg|\.png)(20\d\d)/i, '$1 $2');

        var htmlWithLinks = cleanedText.replace(/&amp;&/g, '&').replace(urlRegex, '<a href="$1" target="_blank" style="color: blue; text-decoration: underline;">$1</a>');
        cells[i].innerHTML = htmlWithLinks;
      }
    }
  }

  // Put any available map layers into separate tabs
  function tabifyLayerBlocks(body, map) {
    var handles = document.createElement('ul');
    handles.className = 'nav nav-tabs';
    var containers = [];
    var currentNode = body.firstChild;
    while (currentNode != null) {
      if (currentNode.nodeName == 'H5') {
        addTab(currentNode);
        removeAndSetNextSibling();
      } else if (containers.length == 0) {
        removeAndSetNextSibling();
      } else {
        var toMove = currentNode;
        currentNode = currentNode.nextSibling;
        containers[containers.length - 1].appendChild(toMove);
      }
    }
    setActiveTab(handles.firstChild);
    body.appendChild(handles);
    for (var i = 0; i < containers.length; i++) {
      body.appendChild(containers[i]);
    }

    function removeAndSetNextSibling() {
      var toRemove = currentNode;
      currentNode = currentNode.nextSibling;
      toRemove.parentNode.removeChild(toRemove);
    }
    function addTab(header) {
      var nameMatch = /'([^']+)'/.exec(header.textContent);
      var layerName = document.createElement('a');
      layerName.style.cursor = 'default';
      if (nameMatch == null || nameMatch.length == 0 || nameMatch[1] == '') {
        layerName.textContent = header.textContent;
      } else if (map.layers[nameMatch[1]]) {
        layerName.textContent = map.layers[nameMatch[1]].title;
      } else {
        layerName.textContent = nameMatch[1];
      }
      var layerContainer = document.createElement('div');
      containers.push(layerContainer);
      var layerTab = document.createElement('li');
      layerTab.addEventListener('click', function() {
        setActiveTab(layerTab);
      });
      layerTab.appendChild(layerName);
      handles.appendChild(layerTab);
    }
    function setActiveTab(activeHandle) {
      for (var i = 0; i < handles.childNodes.length; i++) {
        var handle = handles.childNodes[i];
        handle.classList.toggle('active', handle == activeHandle);
        handle.firstChild.style.color = (handle == activeHandle ? '#3d3d3d' : '');
        handle.firstChild.style.fontWeight = (handle == activeHandle ? 700 : 400);
        var container = containers[i];
        container.classList.toggle('hidden', handle != activeHandle);
      }
    }
  }

  function applyAllTransformations(body, map) {
    transposeTables(body);
    transformUrlsToLinks(body);
    cleanTableRows(body);
    reorderTableRows(body, map);
    tabifyLayerBlocks(body, map);
  }
  //#endregion

///#region UI support functions
    // --- UNIVERSAL CLIPBOARD COPIER ---
  function omCopyTextToClipboard(text) {
    if (text == null) return Promise.reject(new Error('Nothing to copy'));
    var s = String(text);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(s);
    }
    return new Promise(function(resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = s;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed; top:-1000px; left:-1000px; opacity:0; pointer-events:none;';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
        document.body.removeChild(ta);
        if (ok) resolve();
        else reject(new Error('Copy failed'));
      } catch (e) {
        reject(e);
      }
    });
  }

  function createClipboardCopier(labelText, copyValue, compact) {
    var container = document.createElement('div');
    container.style.cssText = 'margin-bottom:10px; font-family:monospace; border-radius:4px; display:flex; justify-content:space-between; align-items:center; gap:8px;';

    // Styling toggle based on context
    if (compact) {
      container.style.fontSize = '11px';
      container.style.background = '#f0f2f5';
      container.style.border = '1px solid #dadce0';
      container.style.padding = '6px';
      container.style.marginTop = '5px';
    } else {
      container.style.fontSize = '12px';
      container.style.background = '#eef5ff';
      container.style.border = '1px solid #b6d4fe';
      container.style.padding = '8px';
    }

    var textDiv = document.createElement('div');
    textDiv.style.cssText = 'word-break:break-all; max-height:40px; overflow-y:auto;';
    textDiv.style.color = compact ? '#5f6368' : '#333';
    textDiv.innerHTML = '<strong>' + labelText + '</strong> ' + copyValue;
    container.appendChild(textDiv);

    var copyBtn = document.createElement('wz-button');
    copyBtn.className = 'openmaps-wz-btn-compact';
    copyBtn.setAttribute('color', 'secondary');
    copyBtn.setAttribute('size', 'sm');

    var defaultHtml = compact ? '<i class="fa fa-copy"></i>' : '<i class="fa fa-copy"></i> Copy';
    var successHtml = compact ? '<i class="fa fa-check"></i>' : '<i class="fa fa-check"></i> Copied!';

    copyBtn.innerHTML = defaultHtml;
    copyBtn.title = 'Copy to clipboard';
    copyBtn.style.flexShrink = '0';
    copyBtn.addEventListener('click', function() {
      omCopyTextToClipboard(copyValue).then(function() {
        copyBtn.setAttribute('color', 'positive');
        copyBtn.innerHTML = successHtml;
        setTimeout(function() {
          copyBtn.setAttribute('color', 'secondary');
          copyBtn.innerHTML = defaultHtml;
        }, 2000);
      });
    });
    container.appendChild(copyBtn);
    return container;
  }
  // ----------------------------------


  function createLayerToggler(parentGroup, checked, name, toggleCallback) {
    var normalizedName = name.toLowerCase().replace(/\s/g, '');
    if (parentGroup == null) {
      var group = document.createElement('li');
      group.className = 'group';
      var groupChildren = document.createElement('ul');
var groupToggler = document.createElement('div');
      groupToggler.className = 'layer-switcher-toggler-tree-category';

      // FIX: Wrap the caret in Waze's native Web Component button for the grey circle
      var groupCaret = document.createElement('wz-button');
      groupCaret.setAttribute('color', 'clear-icon');
      groupCaret.setAttribute('size', 'sm');
      groupCaret.className = 'toggle-category';
      groupCaret.innerHTML = '<i class="w-icon w-icon-caret-down"></i>';
      var caretIcon = groupCaret.querySelector('i');

      if (!checked) {
        caretIcon.classList.add('upside-down');
      }
      groupCaret.dataset.groupId = 'GROUP_' + normalizedName;
      groupToggler.appendChild(groupCaret);

      var groupSwitch = document.createElement('wz-toggle-switch');
      groupSwitch.className = 'layer-switcher-group_' + normalizedName;
      groupSwitch.id = 'layer-switcher-group_' + normalizedName;
      groupToggler.appendChild(groupSwitch);
      var groupSwitchLabel = document.createElement('label');
      groupSwitchLabel.className = 'label-text';
      groupSwitchLabel.htmlFor = groupSwitch.id;
      groupSwitchLabel.textContent = name;
      groupToggler.appendChild(groupSwitchLabel);
      group.appendChild(groupToggler);
      groupChildren.className = 'collapsible-GROUP_' + normalizedName;
      group.appendChild(groupChildren);
      document.querySelector('.list-unstyled.togglers').appendChild(group);

      groupCaret.addEventListener('click', function(e) {
        caretIcon.classList.toggle('upside-down');
        groupChildren.classList.toggle('collapse-layer-switcher-group');
      });
      groupSwitch.checked = checked;
      return group;
    } else {
var layerItem = document.createElement('li');
      // FIX: Removed the hardcoded checked="" so it doesn't factory-reset when moved!
      layerItem.innerHTML = `<wz-checkbox id="layer-switcher-${normalizedName}" value="off">${name}</wz-checkbox>`;
      var layerToggle = layerItem.querySelector('wz-checkbox');
      parentGroup.querySelector('ul').appendChild(layerItem);

      var parentSwitch = parentGroup.querySelector('wz-toggle-switch');
      var parentObserver = new MutationObserver(() => {
        layerToggle.disabled = !parentSwitch.hasAttribute('checked');
        toggleCallback && toggleCallback(layerToggle.checked && parentSwitch.hasAttribute('checked'));
      });
      parentObserver.observe(parentSwitch, { attributes: true, attributeFilter: ['checked'] });

      // FIX: Use 'change' event for Waze components instead of 'click' to avoid event races
      layerToggle.addEventListener('change', e => {
        toggleCallback(e.target.checked && parentSwitch.hasAttribute('checked'));
      });

      // Set initial state (both property AND attribute so it survives Drag & Drop)
      layerToggle.checked = checked;
      if (checked) layerToggle.setAttribute('checked', '');
      else layerToggle.removeAttribute('checked');

      return layerItem;
    }
  }

function getNotAddedMaps() {
    var out = [];
    maps.forEach(function(map) {
      if (!handles.some(function(h) { return map.id == h.mapId; })) out.push(map);
    });
    return out;
  }

  function isMapFavorite(mapId) {
    return Settings.get().state.favoriteMapIds.indexOf(mapId) !== -1;
  }

  function setMapFavorite(mapId, favorite) {
    var s = Settings.get();
    var arr = s.state.favoriteMapIds;
    var idx = arr.indexOf(mapId);
    if (favorite && idx === -1) arr.push(mapId);
    if (!favorite && idx !== -1) arr.splice(idx, 1);
    Settings.put(s);
  }

  function applyActiveMapsFilter() {
    var q = (activeMapsFilterInput.value || '').trim().toLowerCase();
    var mode = activeMapsFilterMode.value;
    var anyShown = false;
    handles.forEach(function(h) {
      var node = handleList.querySelector('.maps-menu-item[data-map-id="' + h.mapId + '"]');
      if (!node) return;
      var map = maps.get(h.mapId);
      if (!map) return;
      var show = true;
      if (q) {
        var regionLabel = I18n.t('openmaps.areas.' + map.area) || map.area || '';
        var hay = (map.title + ' ' + regionLabel + ' ' + (map.area || '') + ' ' + (map.type || '')).toLowerCase();
        if (hay.indexOf(q) < 0) show = false;
      }
      if (show && mode === 'favorites' && !isMapFavorite(h.mapId)) show = false;
      if (show && mode === 'in_view' && h.outOfArea) show = false;
      if (show && mode === 'visible' && !(h.layer && h.layer.getVisibility())) show = false;
      if (show && mode === 'tou_pending') {
        var touPending = map.touId !== 'none' && TOU_REGISTRY[map.touId] && !isTouAccepted(map.touId);
        if (!touPending) show = false;
      }
      node.style.display = show ? '' : 'none';
      node.setAttribute('aria-hidden', show ? 'false' : 'true');
      if (show) anyShown = true;
    });
    activeMapsFilterEmpty.textContent = I18n.t('openmaps.active_maps_filter_no_match');
    activeMapsFilterEmpty.style.display = (handles.length > 0 && !anyShown) ? 'block' : 'none';
  }

  function compareMapsForAddList(a, b) {
    var fa = isMapFavorite(a.id), fb = isMapFavorite(b.id);
    if (fa !== fb) return fa ? -1 : 1;
    return (a.title || '').localeCompare(b.title || '');
  }

  function syncAddMapViewportHint() {
    var notAdded = getNotAddedMaps();
    if (notAdded.length > 0) {
      addMapViewportHint.textContent = I18n.t('openmaps.add_map_pick_hint');
      addMapViewportHint.style.display = 'block';
    } else {
      addMapViewportHint.textContent = '';
      addMapViewportHint.style.display = 'none';
    }
  }

  function showTouGateNotice(mapTitle) {
    var touNotice = document.createElement('div');
    touNotice.className = 'openmaps-sidebar-notice openmaps-sidebar-notice--tou';
    touNotice.setAttribute('role', 'status');
    var touNoticeMsg = document.createElement('div');
    touNoticeMsg.className = 'openmaps-sidebar-notice-message';
    touNoticeMsg.textContent = I18n.t('openmaps.tou_gate_banner').replace(/\{title\}/g, mapTitle);
    var touNoticeDismiss = document.createElement('wz-button');
    touNoticeDismiss.className = 'openmaps-wz-btn-compact';
    touNoticeDismiss.setAttribute('size', 'sm');
    touNoticeDismiss.setAttribute('color', 'secondary');
    touNoticeDismiss.textContent = I18n.t('openmaps.notice_dismiss');
    touNoticeDismiss.addEventListener('click', function() { touNotice.remove(); });
    touNotice.appendChild(touNoticeMsg);
    touNotice.appendChild(touNoticeDismiss);
    tab.insertBefore(touNotice, tab.firstChild);
  }

function selectMapToAdd(mapId) {
    var addedMap = maps.get(mapId);
    if (!addedMap && mapId != null && mapId !== '') {
      var n = Number(mapId);
      if (!isNaN(n)) addedMap = maps.get(n);
    }
    if (!addedMap) return;
    handles.push(new MapHandle(addedMap));
    if (openMapsInspectorApi) openMapsInspectorApi.notifyHandlesChanged();
    if (addedMap.touId !== 'none' && TOU_REGISTRY[addedMap.touId] && !isTouAccepted(addedMap.touId)) {
      showTouGateNotice(addedMap.title);
    }
    saveMapState();
    addMapInput.value = '';
    hideAddMapSuggestions();
    addMapInput.blur();
    updateMapSelector();
    refreshMapDrag();
    var lastCard = handleList.querySelector('.maps-menu-item:last-of-type');
    if (lastCard) lastCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

function isAddMapIntersectingViewport(map) {
    var currentExtent = getMapExtent();
    if (!currentExtent) return true;
    var dataProjection = new OpenLayers.Projection('EPSG:4326');
    var bounds = new OpenLayers.Bounds(map.bbox[0], map.bbox[1], map.bbox[2], map.bbox[3]).transform(dataProjection, W.map.getProjectionObject());
    return bounds.intersectsBounds(currentExtent);
  }

function populateAddMapSuggestions(filterText) {
    while (addMapSuggestions.firstChild) {
      addMapSuggestions.removeChild(addMapSuggestions.firstChild);
    }
    var q = (filterText || '').trim().toLowerCase();
    var allNotAdded = getNotAddedMaps().slice().sort(compareMapsForAddList);
    var inViewOnly = addMapsFilterMode.value === 'in_view';
    var notAdded = inViewOnly ? allNotAdded.filter(isAddMapIntersectingViewport) : allNotAdded;
    if (allNotAdded.length === 0) {
      var allAdded = document.createElement('div');
      allAdded.className = 'openmaps-add-map-suggestion-empty';
      allAdded.textContent = I18n.t('openmaps.add_map_all_added');
      addMapSuggestions.appendChild(allAdded);
      syncAddMapViewportHint();
      if (addMapSuggestions.style.display === 'block') positionAddMapSuggestions();
      return;
    }
    if (inViewOnly && notAdded.length === 0) {
      var noneView = document.createElement('div');
      noneView.className = 'openmaps-add-map-suggestion-empty';
      noneView.textContent = I18n.t('openmaps.add_maps_none_in_view');
      addMapSuggestions.appendChild(noneView);
      syncAddMapViewportHint();
      if (addMapSuggestions.style.display === 'block') positionAddMapSuggestions();
      return;
    }
    var rowCount = 0;
    notAdded.forEach(function(map) {
      var regionLabel = I18n.t('openmaps.areas.' + map.area) || map.area || '';
      if (q) {
        var hay = (map.title + ' ' + regionLabel + ' ' + (map.area || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return;
      }
      rowCount++;
      var row = document.createElement('div');
      row.className = 'openmaps-add-map-suggestion-row';
      row.setAttribute('role', 'option');
      row.dataset.mapId = String(map.id);
      row.addEventListener('click', function() {
        selectMapToAdd(row.dataset.mapId);
      });
      if (map.area && map.area !== 'user') {
        var flagImg = document.createElement('img');
        flagImg.src = 'https://flagcdn.com/16x12/' + map.area.toLowerCase() + '.png';
        flagImg.alt = '';
        flagImg.className = 'openmaps-add-map-suggestion-flag';
        flagImg.title = regionLabel;
        flagImg.onerror = function() { flagImg.style.visibility = 'hidden'; };
        row.appendChild(flagImg);
      } else {
        var spacer = document.createElement('span');
        spacer.className = 'openmaps-add-map-suggestion-flag-spacer';
        row.appendChild(spacer);
      }
      var textCol = document.createElement('div');
      textCol.className = 'openmaps-add-map-suggestion-text';
      var titleEl = document.createElement('div');
      titleEl.className = 'openmaps-add-map-suggestion-title';
      titleEl.textContent = map.title;
      var subEl = document.createElement('div');
      subEl.className = 'openmaps-add-map-suggestion-sub';
      subEl.textContent = regionLabel;
      textCol.appendChild(titleEl);
      textCol.appendChild(subEl);
      row.appendChild(textCol);
      addMapSuggestions.appendChild(row);
    });
    if (rowCount === 0) {
      var none = document.createElement('div');
      none.className = 'openmaps-add-map-suggestion-empty';
      none.textContent = I18n.t('openmaps.add_map_no_matches');
      addMapSuggestions.appendChild(none);
    }
    syncAddMapViewportHint();
    if (addMapSuggestions.style.display === 'block') {
      positionAddMapSuggestions();
    }
  }

function updateMapSelector() {
    const currentExtent = getMapExtent();
    var localMaps = [];
    if (currentExtent) {
      let dataProjection = new OpenLayers.Projection('EPSG:4326');
      maps.forEach((map) => {
        let bounds = new OpenLayers.Bounds(map.bbox[0], map.bbox[1], map.bbox[2], map.bbox[3]).transform(dataProjection, W.map.getProjectionObject());
        if (bounds.intersectsBounds(currentExtent)) {
          localMaps.push(map);
        }
      });
    }

    if (addMapSuggestions.style.display === 'block') {
      populateAddMapSuggestions(addMapInput.value);
    }

    if (!currentExtent) {
      syncAddMapViewportHint();
      applyActiveMapsFilter();
      return;
    }

    handles.forEach(function(handle) {
      var handleIsLocal = localMaps.some((map) => map.id == handle.mapId);
      if (handleIsLocal && handle.outOfArea) {
        handle.outOfArea = false;
        if (handle.layer) handle.layer.setVisibility(!handle.hidden);
        if (handle.updateVisibility) handle.updateVisibility();
      }
      if (!handleIsLocal && !handle.outOfArea) {
        handle.outOfArea = true;
        if (handle.layer) handle.layer.setVisibility(false);
        if (handle.updateVisibility) handle.updateVisibility();
      }
    });
    syncAddMapViewportHint();
    applyActiveMapsFilter();
  }

/** Esri REST JSON geometry → OpenLayers.Geometry (EPSG:3857 coords). Shared by ESRI_FEATURE overlay and Map Inspector. */
function openMapsEsriGeometryToOpenLayers(g) {
  if (!g || typeof OpenLayers === 'undefined') return null;
  try {
    if (g.x !== undefined && g.y !== undefined) {
      return new OpenLayers.Geometry.Point(Number(g.x), Number(g.y));
    }
    if (g.rings && g.rings.length) {
      var linears = [];
      for (var ri = 0; ri < g.rings.length; ri++) {
        var ring = g.rings[ri];
        if (!ring || !ring.length) continue;
        var pts = [];
        for (var pi = 0; pi < ring.length; pi++) {
          pts.push(new OpenLayers.Geometry.Point(ring[pi][0], ring[pi][1]));
        }
        linears.push(new OpenLayers.Geometry.LinearRing(pts));
      }
      if (!linears.length) return null;
      return new OpenLayers.Geometry.Polygon(linears);
    }
    if (g.paths && g.paths.length) {
      var lines = [];
      for (var pi2 = 0; pi2 < g.paths.length; pi2++) {
        var path = g.paths[pi2];
        if (!path || !path.length) continue;
        var pts2 = [];
        for (var pj = 0; pj < path.length; pj++) {
          pts2.push(new OpenLayers.Geometry.Point(path[pj][0], path[pj][1]));
        }
        lines.push(new OpenLayers.Geometry.LineString(pts2));
      }
      if (!lines.length) return null;
      if (lines.length === 1) return lines[0];
      return new OpenLayers.Geometry.MultiLineString(lines);
    }
  } catch (e) {
    return null;
  }
  return null;
}

function getMapExtent() {
    // Directly access the underlying OpenLayers map instance for stability
    const olMap = W.map.getOLMap();
    const extent = olMap.getExtent();
    return extent ? extent.clone() : null;
  }

  //#endregion

  //#region Map tile support functions
function openMapsEscapeForHtmlTooltip(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

function loadTileError(tile, callback) {
    GM_xmlhttpRequest({
      method: 'GET',
      url: tile.url,
      timeout: 8000,
      onload: function (response) {
        // Ignore 404/204s: Many map servers return these for perfectly normal, empty map areas
        if (response.status === 404 || response.status === 204) {
          callback({ ok: true });
          return;
        }

        if (response.status === 200) {
          if (!response.responseXML) {
            response.responseXML = new DOMParser().parseFromString(response.responseText, 'text/xml');
          }
          var serviceException = response.responseXML.querySelector('ServiceException');
          if (serviceException) {
            var errCode = serviceException.getAttribute('code');
            callback({
              title: errCode ? errCode.replace(/([a-z])([A-Z])/g, '$1 $2') : 'Service Exception',
              description: serviceException.textContent.trim()
            });
          } else {
            if (response.responseHeaders.indexOf('Content-Type: image') !== -1) {
              callback({ ok: true });
              tile.clear(); tile.draw();
              return;
            }
            callback({ title: 'Invalid Response', description: 'Server did not return a valid map image.' });
          }
        } else {
          var statusText = response.statusText || 'Connection Refused / CORS';
          callback({
            title: 'Server Error',
            description: 'HTTP ' + (response.status || '0') + ': ' + statusText
          });
        }
      },
      ontimeout: function() { callback({ title: 'Timeout', description: 'Server took too long to respond.' }); },
      onerror: function() { callback({ title: 'Network Error', description: 'Failed to reach the map server. (Blocked or Offline)' }); }
    });
  }

  var tileManipulations = {
    // Replace all fully black pixels with white pixels
    'black2white': bitmap => {
      var dirty = false;
      for (let i = 0; i < bitmap.data.length; i += 4) {
        if (bitmap.data[i + 0] == 0 && bitmap.data[i + 1] == 0 && bitmap.data[i + 2] == 0) {
          bitmap.data[i + 0] = bitmap.data[i + 1] = bitmap.data[i + 2] = 255;
          dirty = true;
        }
      }
      return dirty;
    },
    // For the Oman map: change the beige colour to transparent
    'omanTransparent': bitmap => {
      var dirty = false;
      for (let i = 0; i < bitmap.data.length; i += 4) {
        if (bitmap.data[i + 0] == 235 && bitmap.data[i + 1] == 232 && bitmap.data[i + 2] == 222) {
          bitmap.data[i + 3] = 0;
          dirty = true;
        }
      }
      return dirty;
    },
    // For the Rio de Janeiro map: change the beige colour to transparent
    'rioTransparent': bitmap => {
      var dirty = false;
      for (let i = 0; i < bitmap.data.length; i += 4) {
        if (bitmap.data[i + 0] == 235 && bitmap.data[i + 1] == 255 && bitmap.data[i + 2] == 242) {
          bitmap.data[i + 3] = 0;
          dirty = true;
        }
      }
      return dirty;
    },
    // Remove partial transparency, calculate colour as if it were on a white background
    'removePartialTransparency': bitmap => {
      var dirty = false;
      for (let i = 0; i < bitmap.data.length; i += 4) {
        if (bitmap.data[i + 3] > 0) {
          bitmap.data[i + 0] = Math.floor(255 - bitmap.data[i + 3] + (bitmap.data[i + 3] / 255) * bitmap.data[i + 0] + 0.5);
          bitmap.data[i + 1] = Math.floor(255 - bitmap.data[i + 3] + (bitmap.data[i + 3] / 255) * bitmap.data[i + 1] + 0.5);
          bitmap.data[i + 2] = Math.floor(255 - bitmap.data[i + 3] + (bitmap.data[i + 3] / 255) * bitmap.data[i + 2] + 0.5);
          bitmap.data[i + 3] = 255;
          dirty = true;
        }
      }
      return dirty;
    },
    // Replace the colours for the Brussels map with the corresponding colours used in the WME for road types
    'brusselsSwapColours': bitmap => {
      var dirty = false;
      for (let i = 0; i < bitmap.data.length; i += 4) {
        if (bitmap.data[i + 3] > 0 && bitmap.data[i] == bitmap.data[i + 1] && bitmap.data[i + 1] == bitmap.data[i + 2]) {
          bitmap.data[i + 0] = 255;
          bitmap.data[i + 1] = 252;
          bitmap.data[i + 2] = 208;
          dirty = true;
        } else if (bitmap.data[i + 3] > 0 && bitmap.data[i] >= bitmap.data[i + 2]) {
          bitmap.data[i + 0] = 69;
          bitmap.data[i + 1] = 184;
          bitmap.data[i + 2] = 209;
          dirty = true;
        } else if (bitmap.data[i + 3] > 0 && bitmap.data[i] < bitmap.data[i + 2]) {
          bitmap.data[i + 0] = 105;
          bitmap.data[i + 1] = 191;
          bitmap.data[i + 2] = 136;
          dirty = true;
        }
      }
      return dirty;
    },
    // Remove partial transparency for black pixels, calculate colour as if it were on a white background
    'removePartialBlackTransparency': bitmap => {
      var dirty = false;
      for (let i = 0; i < bitmap.data.length; i += 4) {
        if (bitmap.data[i] < 5 && bitmap.data[i + 1] < 5 && bitmap.data[i + 2] < 5 && bitmap.data[i + 3] > 0) {
          bitmap.data[i + 0] = 255 - bitmap.data[i + 3];
          bitmap.data[i + 1] = 255 - bitmap.data[i + 3];
          bitmap.data[i + 2] = 255 - bitmap.data[i + 3];
          bitmap.data[i + 3] = 255;
          dirty = true;
        }
      }
      return dirty;
    },
    // Add white pixels around any grayscale pixels
    'traceGrayscalePixels': bitmap => {
      var dirty = false;
      var surroundingPixels = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
      var pixelsSinceTrace = 2; // How many pixels ago did we trace around a pixel?
      for (let i = 0; i < bitmap.data.length; i += 4) {
        pixelsSinceTrace++;
        // Find opaque, non-white grayscale pixels
        if (bitmap.data[i + 3] != 0 && bitmap.data[i] != 255 && bitmap.data[i] == bitmap.data[i + 1] && bitmap.data[i + 1] == bitmap.data[i + 2]) {
          // Do not check positions we know have been checked by a previous iteration
          var positionsToCheck = (pixelsSinceTrace == 1) ? 3 : ((pixelsSinceTrace == 2) ? 5 : 8);
          surroundingPixels.slice(-1 * positionsToCheck).forEach(pixelRelation => {
            var x = ((i / 4) % bitmap.width) + pixelRelation[0],
                y = Math.floor((i / 4) / bitmap.width) + pixelRelation[1],
                offset = (y * bitmap.width + x) * 4;
            if (x >= 0 && x < bitmap.width && y >= 0 && y < bitmap.height && bitmap.data[offset + 3] == 0) {
              bitmap.data[offset + 0] = bitmap.data[offset + 1] = bitmap.data[offset + 2] = 255;
              bitmap.data[offset + 3] = 200;
              dirty = true;
            }
          });
          pixelsSinceTrace = 0;
        }
      }
      return dirty;
    },
    // Turn white tiles transparent
    'whiteTiles2transparent': bitmap => {
      var dirty = false;
      var pixelArray = new Uint32Array(bitmap.data.buffer);
      var white = 0xFFFFFFFF;
      var transparent = 0x00FFFFFF;
      var whitePixels = 0;
      // Do some analysis of the top and bottom borders to see whether this run is actually needed?
      for (var i = 0; i < bitmap.width; i++) {
        if (pixelArray[i] == white) {
          whitePixels++;
        }
      }
      for (var i = pixelArray.length - bitmap.width; i < pixelArray.length; i++) {
        if (pixelArray[i] == white) {
          whitePixels++;
        }
      }
      if (whitePixels > bitmap.width / 2) { // More than a quarter of the pixels are white
        pixelArray.forEach((pixel, idx) => {
          if (pixel == white) {
            pixelArray[idx] = transparent;
            dirty = true;
          }
        });
      }
      return dirty;
    },

      // Advanced dirty-white removal with edge sensitivity
    'dirtyWhite2transparent': bitmap => {
      let dirty = false;

      // --- TUNING PARAMETERS ---
      // 255 is pure white. 240 catches light gray JPEG artifacts.
      const rgbTolerance = 240;
      // What percentage of the tile's 4 OUTER EDGES must be dirty white to trigger?
      // (0.24 means basically just ONE full side of a square tile must be white)
      const edgeSensitivity = 0.01;
      // -------------------------

      const data = bitmap.data;
      const w = bitmap.width;
      const h = bitmap.height;

      // Helper function: Is this pixel close enough to pure white?
      const isDirtyWhite = (index) => {
        return data[index] >= rgbTolerance &&
               data[index + 1] >= rgbTolerance &&
               data[index + 2] >= rgbTolerance;
      };

      // 1. Scan the 4 outer edges of the tile (Top, Bottom, Left, Right)
      let edgeWhiteCount = 0;
      const totalEdgePixels = (w * 2) + (h * 2) - 4;

      // Top and Bottom edges
      for (let x = 0; x < w; x++) {
        if (isDirtyWhite((0 * w + x) * 4)) edgeWhiteCount++;             // Top row
        if (isDirtyWhite(((h - 1) * w + x) * 4)) edgeWhiteCount++;       // Bottom row
      }
      // Left and Right edges (excluding the corners we already counted)
      for (let y = 1; y < h - 1; y++) {
        if (isDirtyWhite((y * w + 0) * 4)) edgeWhiteCount++;             // Left column
        if (isDirtyWhite((y * w + (w - 1)) * 4)) edgeWhiteCount++;       // Right column
      }

      // 2. If the perimeter has enough white, wipe the white from the ENTIRE tile!
      if ((edgeWhiteCount / totalEdgePixels) >= edgeSensitivity) {
        for (let i = 0; i < data.length; i += 4) {
          if (isDirtyWhite(i)) {
            data[i + 3] = 0; // Set Alpha to 0 (Transparent)
            dirty = true;
          }
        }
      }

      return dirty;
    },



    // Turn blank tiles transparent - tuned to 0xFFFDFDFD for Virginia
    'vaBlankTiles2Transparent': bitmap => {
      var dirty = false;
      var pixelArray = new Uint32Array(bitmap.data.buffer);
      var white = 0xFFFFFFFF;
      var offwhite = 0xFFFDFDFD;
      var transparent = 0x00FFFFFF;
      var whitePixels = 0;
      // Do some analysis of the top and bottom borders to see whether this run is actually needed?
      for (var i = 0; i < bitmap.width; i++) {
        if (pixelArray[i] == white || pixelArray[i] == offwhite) {
          whitePixels++;
        }
      }
      for (var i = pixelArray.length - bitmap.width; i < pixelArray.length; i++) {
        if (pixelArray[i] == white || pixelArray[i] == offwhite) {
          whitePixels++;
        }
      }
      if (whitePixels > bitmap.width / 2) { // More than a quarter of the pixels are white
        pixelArray.forEach((pixel, idx) => {
          if (pixel == white || pixel == offwhite) {
            pixelArray[idx] = transparent;
            dirty = true;
          }
        });
      }
      return dirty;
    },
    // Add a semi-transparent white overlay to make map details visible on satellite imagery
    'addTranslucentOverlay': bitmap => {
      var dirty = false;
      var pixelArray = new Uint32Array(bitmap.data.buffer);
      var whiteTranslucent = 0x33FFFFFF;
      var transparent = 0x00000000;
      pixelArray.forEach((pixel, idx) => {
          if (pixel == transparent) {
            pixelArray[idx] = whiteTranslucent;
            dirty = true;
          }
        });
      return dirty;
    }
  }

  function openMapsNormalizePixelManipulations(list) {
    if (!Array.isArray(list)) return null;
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var k = String(list[i] || '').trim();
      if (!k) continue;
      if (!tileManipulations.hasOwnProperty(k)) continue;
      if (seen[k]) continue;
      seen[k] = true;
      out.push(k);
    }
    return out;
  }

  function openMapsAvailablePixelManipulationOps() {
    return Object.keys(tileManipulations).slice().sort();
  }

  // Manipulate a map tile received from the source
  function manipulateTile(event, manipulations) {
    if (event.aborted || !event.tile || !event.tile.imgDiv) {
      return;
    }
    var newTile = document.createElement('canvas');
    newTile.width = event.tile.imgDiv.width;
    newTile.height = event.tile.imgDiv.height;
    var context = newTile.getContext('2d');
    context.drawImage(event.tile.imgDiv, 0, 0);
    var imageData = context.getImageData(0, 0, newTile.width, newTile.height);
    var replaceNeeded = false;
    manipulations.forEach(manipulation => {
      if (tileManipulations.hasOwnProperty(manipulation)) {
        replaceNeeded = replaceNeeded || tileManipulations[manipulation](imageData);
      }
    });
    if (replaceNeeded) {
      context.putImageData(imageData, 0, 0);
      event.tile.imgDiv.src = newTile.toDataURL('image/png');
    }
  }
  //#endregion

  //#region Map layer handling
  function saveMapState() {
    var settings = Settings.get();
    settings.state.active = [];
    handles.forEach(function(handle) {
      var handleState = {
        mapId: handle.mapId,
        opacity: handle.opacity,
        layers: handle.getLayersForPersistence ? handle.getLayersForPersistence() : handle.mapLayers,
        hidden: handle.hidden,
        transparent: handle.transparent,
        improveMap: handle.improveMap,
        displayBbox: handle.displayBbox,
        brightness: handle.brightness,
        contrast: handle.contrast,
        saturate: handle.saturate,
        hue: handle.hue,
        gamma: handle.gamma,
        invert: handle.invert,
        blendMode: handle.blendMode,
        pixelManipulationsOverride: handle.pixelManipulationsOverride,
        wmsArcgisRestViewportProbe: handle.wmsArcgisRestViewportProbe !== false
      };
      settings.state.active.push(handleState);
    });
    Settings.put(settings);
  }

  /**
   * Persisted `settings.state.userMaps` entries are merged into the runtime `maps` registry so
   * `mapId` in saved active state resolves after reload. `GOOGLE_MY_MAPS` uses KML over the network.
   * Outlook: add user WMS / ArcGIS MapServer / XYZ by storing the same map-definition shape as catalog entries here.
   */
  function mergeOpenMapsUserMapDefinitionsIntoRegistry() {
    var s = Settings.get();
    if (!Array.isArray(s.state.userMaps)) return;
    s.state.userMaps.forEach(function(um) {
      if (um && um.id != null && um.id !== '') maps.set(um.id, um);
    });
  }

  function openMapsRemoveUserMapDefinition(mapId) {
    var s = Settings.get();
    if (!Array.isArray(s.state.userMaps)) return;
    var next = s.state.userMaps.filter(function(m) { return !m || m.id !== mapId; });
    if (next.length === s.state.userMaps.length) return;
    s.state.userMaps = next;
    maps.delete(mapId);
    Settings.put(s);
    var idxFav = s.state.favoriteMapIds.indexOf(mapId);
    if (idxFav !== -1) {
      s.state.favoriteMapIds.splice(idxFav, 1);
      Settings.put(s);
    }
  }

  function openMapsNewUserMapId() {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return 'om-um-' + crypto.randomUUID();
    } catch (eId) { /* ignore */ }
    return 'om-um-' + String(Date.now()) + '-' + String(Math.random()).slice(2, 11);
  }

  function openMapsGoogleMyMapsKmlUrlFromMid(mid) {
    var m = String(mid || '').trim();
    if (!m) return null;
    return 'https://www.google.com/maps/d/kml?mid=' + encodeURIComponent(m);
  }

  /** @returns {{ mid: string, kmlUrl: string, originalUrl: string|null }|null} */
  function openMapsParseGoogleMyMapsInput(raw) {
    var t = String(raw || '').trim();
    if (!t) return null;
    t = t.replace(/^[\s"'<(]+|[\s"'>)]+$/g, '').replace(/[\s\)\].,;>]+$/g, '');
    if (!t) return null;
    var mid = null;
    if (/^https?:\/\//i.test(t)) {
      try {
        var u = new URL(t);
        mid = u.searchParams.get('mid');
        if (!mid && u.hash) {
          var hash = u.hash.replace(/^#/, '');
          var hp = new URLSearchParams(hash);
          mid = hp.get('mid');
          if (!mid) {
            var hm = hash.match(/(?:^|&)mid=([^&]+)/i);
            if (hm) {
              try {
                mid = decodeURIComponent(hm[1]);
              } catch (eH) {
                mid = hm[1];
              }
            }
          }
        }
      } catch (eUrl) { /* ignore */ }
    }
    if (!mid) {
      var m = t.match(/[#&?]mid=([^&?#\s]+)/i);
      if (m) {
        try {
          mid = decodeURIComponent(m[1]);
        } catch (eDec) {
          mid = m[1];
        }
      }
    }
    if (!mid && /^[a-zA-Z0-9_-]{12,}$/.test(t) && t.indexOf('/') === -1 && t.indexOf(' ') === -1) mid = t;
    if (!mid) return null;
    mid = String(mid).trim();
    if (!mid) return null;
    var kmlUrl;
    if (/^https?:\/\//i.test(t) && /\/kml/i.test(t)) kmlUrl = t.split('#')[0];
    else kmlUrl = openMapsGoogleMyMapsKmlUrlFromMid(mid);
    return { mid: mid, kmlUrl: kmlUrl, originalUrl: /^https?:\/\//i.test(t) ? t.split('#')[0] : null };
  }

  //#region Reload previous map(s)
  // IMPORTANT: This must run after tileManipulations + pixel manipulation helpers are initialized,
  // because MapHandle's edit panel can reference them during boot.
  mergeOpenMapsUserMapDefinitionsIntoRegistry();
  if (Settings.exists()) {
    var settings = Settings.get();
    settings.state.active.forEach(function(mapHandle, i) {
      if (!maps.has(mapHandle.mapId)) { // no strict equal as null should fail as well
        settings.state.active.splice(i, 1);
        Settings.put(settings);
        return;
      }
      handles.push(new MapHandle(maps.get(mapHandle.mapId), {
        opacity: mapHandle.opacity,
        layers: mapHandle.layers,
        hidden: mapHandle.hidden,
        transparent: mapHandle.transparent,
        improveMap: mapHandle.improveMap,
        displayBbox: mapHandle.displayBbox,
        brightness: mapHandle.brightness,
        contrast: mapHandle.contrast,
        saturate: mapHandle.saturate,
        hue: mapHandle.hue,
        gamma: mapHandle.gamma,
        invert: mapHandle.invert,
        blendMode: mapHandle.blendMode,
        pixelManipulationsOverride: mapHandle.pixelManipulationsOverride,
        wmsArcgisRestViewportProbe: mapHandle.wmsArcgisRestViewportProbe
      }));
      saveMapState();
    });
    if (openMapsInspectorApi) openMapsInspectorApi.notifyHandlesChanged();
  }
  //#endregion

  // --- NEW: Trigger the Background ToU Engine on boot! ---
  runToUBackgroundChecks();

  // FIX: Force the search list to recalculate AFTER saved maps are restored!
  updateMapSelector();
  refreshMapDrag(); // Make saved maps draggable on boot!

  /** Session cache for WMS GetCapabilities / ESRI MapServer JSON (one entry per map id + url). */
  var sessionLayerCatalog = {};

  function sessionLayerCatalogKey(map) {
    return map.id + '|' + map.url;
  }

  function getCapabilitiesUrlForMap(map) {
    var isWMS = map.type === 'WMS';
    return isWMS
      ? map.url + (map.url.indexOf('?') > -1 ? '&' : '?') + 'SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities'
      : map.url + '?f=pjson';
  }

  /** ArcGIS REST MapServer base when `url` is an Esri WMS endpoint (…/MapServer/WMSServer); else null. Shared by Map Inspector and map options. */
  function openMapsArcgisRestBaseFromWmsUrl(u) {
    if (!u || typeof u !== 'string') return null;
    var s = u.replace(/\/+$/, '').split('?')[0];
    var m = s.match(/^(https?:\/\/[^/]+)\/(arcgis\d*)\/services\/(.+)\/(MapServer)\/WMSServer$/i);
    if (m) return m[1] + '/' + m[2] + '/rest/services/' + m[3] + '/' + m[4];
    return null;
  }

  /** True when fetchLayerCatalogSession will wait on the network (or an in-flight request), not a synchronous cache hit. */
  function willAwaitLayerCatalogNetwork(map, forceRefresh) {
    var ex = sessionLayerCatalog[sessionLayerCatalogKey(map)];
    if (!forceRefresh && ex && ex.status === 'ok') return false;
    return true;
  }

  /**
   * Parse WMS GetCapabilities XML: collect every Layer node under Capability (any nesting depth,
   * prefixed tags, or multiple root Layer siblings); read Name/Title/Queryable from direct children only
   * (avoids picking up Style/legend Name nodes deeper in the tree).
   */
  function parseWmsCapabilitiesXml(xmlString) {
    var xml = new DOMParser().parseFromString(xmlString, 'text/xml');
    if (xml.getElementsByTagName('parsererror').length) {
      return { layers: [], error: 'parse' };
    }
    function localName(el) {
      return el.localName || (el.nodeName && el.nodeName.split(':').pop()) || '';
    }
    function layerElementsUnder(scope) {
      var list = scope.getElementsByTagNameNS ? scope.getElementsByTagNameNS('*', 'Layer') : null;
      if (list && list.length) return list;
      return scope.getElementsByTagName('Layer');
    }
    var cap = xml.getElementsByTagName('Capability')[0];
    if (!cap && xml.getElementsByTagNameNS) {
      var capNs = xml.getElementsByTagNameNS('*', 'Capability');
      if (capNs && capNs.length) cap = capNs[0];
    }
    var scope = cap || xml.documentElement;
    var layerEls = layerElementsUnder(scope);
    var layers = [];
    for (var li = 0; li < layerEls.length; li++) {
      var layerEl = layerEls[li];
      var name = '';
      var title = '';
      var queryable = false;
      if (layerEl.getAttribute) {
        var qAttr = layerEl.getAttribute('queryable');
        if (qAttr != null && String(qAttr).length) queryable = /^1|true$/i.test(String(qAttr).trim());
      }
      var child = layerEl.firstChild;
      while (child) {
        if (child.nodeType === 1) {
          var ln = localName(child);
          if (ln === 'Name') name = (child.textContent || '').trim();
          else if (ln === 'Title') title = (child.textContent || '').trim();
          else if (ln === 'Queryable') queryable = /^1|true$/i.test((child.textContent || '').trim());
        }
        child = child.nextSibling;
      }
      if (name) {
        layers.push({ name: name, title: title || name, queryable: queryable });
      }
    }
    var seen = {};
    var deduped = [];
    for (var d = 0; d < layers.length; d++) {
      if (!seen[layers[d].name]) {
        seen[layers[d].name] = true;
        deduped.push(layers[d]);
      }
    }
    return { layers: deduped };
  }

  function parseEsriMapServerLayersJson(json) {
    if (!json || !json.layers || !json.layers.length) return [];
    return json.layers.map(function(l) {
      var caps = (l.capabilities && String(l.capabilities)) || '';
      var queryable = caps.indexOf('Query') !== -1;
      return { name: String(l.id), title: l.name || String(l.id), queryable: queryable };
    });
  }

  /**
   * Shared parse path for session cache + capabilities viewer: WMS XML or ESRI MapServer JSON.
   * @returns {{ layers: Array<{name:string,title:string,queryable:boolean}>, error?: string }}
   */
  function parseLayerCatalogFromResponse(map, responseText) {
    if (map.type === 'WMS') {
      var w = parseWmsCapabilitiesXml(responseText || '');
      if (w.error) return { layers: [], error: w.error };
      return { layers: w.layers };
    }
    try {
      var j = JSON.parse(responseText || '{}');
      return { layers: parseEsriMapServerLayersJson(j) };
    } catch (e) {
      return { layers: [], error: String(e.message || e) };
    }
  }

  /**
   * Fetch capabilities once per session (unless forceRefresh). Invokes all waiters when done.
   */
  function fetchLayerCatalogSession(map, callback, forceRefresh) {
    var key = sessionLayerCatalogKey(map);
    var existing = sessionLayerCatalog[key];
    if (!forceRefresh && existing && existing.status === 'ok') {
      if (callback) callback(null, existing);
      return;
    }
    if (!forceRefresh && existing && existing.status === 'loading') {
      existing.waiters = existing.waiters || [];
      if (callback) existing.waiters.push(callback);
      return;
    }
    sessionLayerCatalog[key] = { status: 'loading', layers: [], waiters: callback ? [callback] : [] };
    var capUrl = getCapabilitiesUrlForMap(map);
    GM_xmlhttpRequest({
      method: 'GET',
      url: capUrl,
      onload: function(res) {
        var entry = sessionLayerCatalog[key];
        if (!entry) {
          // Ultra-defensive: if something cleared the session entry, do not crash the whole script.
          // (Observed in bridge builds as an uncaught 'forEach' TypeError.)
          sessionLayerCatalog[key] = entry = { status: 'loading', layers: [], waiters: [] };
        }
        entry.raw = res.responseText;
        entry.capUrl = capUrl;
        var httpErr = res.status && res.status >= 400;
        if (httpErr) {
          entry.status = 'error';
          entry.error = 'http' + res.status;
          entry.layers = [];
        } else {
          var parsed = parseLayerCatalogFromResponse(map, res.responseText);
          entry.layers = parsed.layers;
          if (parsed.error) {
            entry.status = 'error';
            entry.error = parsed.error;
          } else {
            entry.status = 'ok';
            delete entry.error;
          }
        }
        var waiters = entry.waiters || [];
        delete entry.waiters;
        if (!Array.isArray(waiters)) waiters = [];
        waiters.forEach(function(cb) { if (cb) cb(entry.status === 'error' ? new Error(entry.error || 'parse') : null, entry); });
      },
      onerror: function() {
        var entry = sessionLayerCatalog[key];
        if (!entry) sessionLayerCatalog[key] = entry = { status: 'loading', layers: [], waiters: [] };
        entry.status = 'error';
        entry.error = 'network';
        var waiters = entry.waiters || [];
        delete entry.waiters;
        if (!Array.isArray(waiters)) waiters = [];
        waiters.forEach(function(cb) { if (cb) cb(new Error('network'), entry); });
      }
    });
  }

function MapHandle(map, options) {
    var self = this;

    // --- 1. STATE INITIALIZATION ---
    this.layer = null;
    this.mapId = map.id;
    this.mapLayers = [];
    this.opacity = (options && options.opacity ? options.opacity : "100");
    this.hidden = (options && options.hidden ? true : false);
    this.transparent = (options && !options.transparent || map.format == 'image/jpeg' ? false : true);
    // Default: only enable pixel manipulations automatically when the catalog defines defaults for this map.
    // (Maps without catalog defaults should start with Apply pixel manipulations = OFF.)
    this.improveMap = (options && options.improveMap !== undefined)
      ? options.improveMap
      : !!map.pixelManipulations;
    this.pixelManipulationsOverride = (options && options.pixelManipulationsOverride !== undefined)
      ? openMapsNormalizePixelManipulations(options.pixelManipulationsOverride)
      : null;
    this.displayBbox = (options && options.displayBbox ? true : false);
    if (map.area === 'UN') this.displayBbox = false;
    // NEW: Image Adjustment State
    this.brightness = (options && options.brightness !== undefined ? options.brightness : 100);
    this.contrast = (options && options.contrast !== undefined ? options.contrast : 100);
    this.saturate = (options && options.saturate !== undefined ? options.saturate : 100);
    this.hue = (options && options.hue !== undefined ? options.hue : 0);
    this.gamma = (options && options.gamma !== undefined ? options.gamma : 100);
    this.invert = (options && options.invert ? true : false);
    this.blendMode = (options && options.blendMode ? options.blendMode : 'normal');
    this.wmsArcgisRestViewportProbe = (options && options.wmsArcgisRestViewportProbe === false) ? false : true;
    this.layerUI = [];
    this.cloudLayerMeta = {};
    this.pendingSavedLayers = [];
    this._orphanSavedLayersDropped = 0;
    /** 'server' | 'local' | undefined — which i18n string to use for orphan hint */
    this._orphanHintKind = undefined;
    this._layerCatalogAppliedOnce = false;
    // NEW: Enforce ToU Lock on Boot
    if (!isTouAccepted(map.touId)) {
      this.hidden = true; // Force hidden if terms not accepted OR config is broken
    }

    // Bounding Box Math (Safely split to prevent OpenLayers NaN corruption)
    this.area = new OpenLayers.Bounds(map.bbox[0], map.bbox[1], map.bbox[2], map.bbox[3]).transform(new OpenLayers.Projection('EPSG:4326'), W.map.getProjectionObject());
    const currentExtent = getMapExtent();
    this.outOfArea = currentExtent ? !this.area.intersectsBounds(currentExtent) : true;

    // UI Element References
    var UI = { touDetails: null, mapLayersNoActiveMark: null, mapLayersSubContainer: null, mapLayersDetailsRoot: null, orphanHintEl: null, layerCatalogLoadingEl: null };

    function getLayerMeta(name) {
      if (map.layers[name]) {
        return { title: map.layers[name].title, abstract: map.layers[name].abstract, queryable: !!map.layers[name].queryable };
      }
      var cm = self.cloudLayerMeta[name];
      if (cm) return { title: cm.title, abstract: undefined, queryable: !!cm.queryable };
      return { title: name, abstract: undefined, queryable: false };
    }
    this.getLayerMeta = getLayerMeta;

    function getLayerOriginKind(name) {
      if (map.layers[name]) return 'curated';
      if (self.cloudLayerMeta[name]) return 'cloud';
      return 'unknown';
    }

    function buildLayerDefinitionSnippet(name) {
      var meta = getLayerMeta(name);
      var line = '        ' + JSON.stringify(name) + ': { title: ' + JSON.stringify(meta.title);
      if (meta.abstract) line += ', abstract: ' + JSON.stringify(meta.abstract);
      line += ', queryable: ' + (meta.queryable ? 'true' : 'false') + ' },';
      return line;
    }

    function getMapLayerNamesForCopy(mode) {
      var names = [];
      if (mode === 'enabledOnly') {
        self.getLayersForPersistence().forEach(function(l) {
          if (l.visible) names.push(l.name);
        });
        return names;
      }

      self.getLayersForPersistence().forEach(function(l) {
        names.push(l.name);
      });

      // Keep any curated-but-missing layers as well (defensive, should already be covered above)
      if (map && map.layers) {
        Object.keys(map.layers).forEach(function(n) { names.push(n); });
      }

      // Dedup while keeping first occurrence order
      var seen = {};
      return names.filter(function(n) {
        if (!n) return false;
        if (seen[n]) return false;
        seen[n] = true;
        return true;
      });
    }

    function getEnabledLayerNamesForCopy() {
      var enabled = [];
      self.getLayersForPersistence().forEach(function(l) {
        if (l.visible) enabled.push(l.name);
      });
      return enabled;
    }

    function buildMapDefinitionSnippet(copyMode) {
      // copyMode: 'allKeepDefaults' | 'allMakeEnabledDefault' | 'enabledOnlyMakeDefault'
      var layerMode = (copyMode === 'enabledOnlyMakeDefault') ? 'enabledOnly' : 'all';
      var names = getMapLayerNamesForCopy(layerMode);
      var enabledNames = getEnabledLayerNamesForCopy();

      var defaultLayers;
      if (copyMode === 'allKeepDefaults') defaultLayers = (map.default_layers || []).slice();
      else defaultLayers = enabledNames.slice();

      function pushLine(arr, k, v, force) {
        if (!force && (v === undefined || v === null)) return;
        arr.push('      ' + k + ': ' + v + ',');
      }

      function formatQueryFilters(qf) {
        if (!qf) return null;
        if (!Array.isArray(qf)) return null;
        var parts = qf.map(function(fn) {
          if (!fn) return null;
          if (typeof fn === 'string') return fn;
          if (typeof fn === 'function' && fn.name) return fn.name;
          return null;
        }).filter(Boolean);
        if (parts.length === 0) return null;
        return '[ ' + parts.join(', ') + ' ]';
      }

      var lines = [];
      lines.push('    {');
      pushLine(lines, 'id', JSON.stringify(map.id), true);
      pushLine(lines, 'title', JSON.stringify(map.title), true);
      pushLine(lines, 'touId', JSON.stringify(map.touId), !!map.touId);
      pushLine(lines, 'favicon', String(!!map.favicon), !!map.favicon);
      pushLine(lines, 'icon', JSON.stringify(map.icon), !!map.icon);
      pushLine(lines, 'type', JSON.stringify(map.type || 'WMS'), true);
      pushLine(lines, 'url', JSON.stringify(map.url), true);
      pushLine(lines, 'queryUrl', JSON.stringify(map.queryUrl), !!map.queryUrl);
      pushLine(lines, 'crs', JSON.stringify(map.crs), !!map.crs);
      if (map.bbox) pushLine(lines, 'bbox', JSON.stringify(map.bbox), true);
      if (map.zoomRange) pushLine(lines, 'zoomRange', JSON.stringify(map.zoomRange), true);
      pushLine(lines, 'format', JSON.stringify(map.format), !!map.format);
      pushLine(lines, 'transparent', String(!!map.transparent), map.transparent !== undefined);
      pushLine(lines, 'area', JSON.stringify(map.area), !!map.area);
      pushLine(lines, 'tile_size', String(map.tile_size), map.tile_size !== undefined);
      pushLine(lines, 'abstract', JSON.stringify(map.abstract), !!map.abstract);
      pushLine(lines, 'attribution', JSON.stringify(map.attribution), !!map.attribution);
      pushLine(lines, 'pixelManipulations', JSON.stringify(map.pixelManipulations), !!map.pixelManipulations);
      pushLine(lines, 'queryable', String(!!map.queryable), map.queryable !== undefined);
      var qf = formatQueryFilters(map.query_filters);
      if (qf) pushLine(lines, 'query_filters', qf, true);
      pushLine(lines, 'default_layers', JSON.stringify(defaultLayers, null, 0), true);

      lines.push('      layers: {');
      names.forEach(function(n) {
        lines.push(buildLayerDefinitionSnippet(n));
      });
      lines.push('      }');
      lines.push('    },');
      return lines.join('\n');
    }

    function getLayerOriginTooltip(name) {
      var kind = getLayerOriginKind(name);
      var base = kind === 'curated' ? I18n.t('openmaps.layer_origin_curated') : (kind === 'cloud' ? I18n.t('openmaps.layer_origin_cloud') : I18n.t('openmaps.layer_origin_unknown'));
      if (map.default_layers.indexOf(name) !== -1) base += ' · ' + I18n.t('openmaps.layer_origin_default');
      return base;
    }

    this.getLayersForPersistence = function() {
      var saved = self.mapLayers.slice();
      self.pendingSavedLayers.forEach(function(p) {
        if (!saved.some(function(s) { return s.name === p.name; })) {
          saved.push({ name: p.name, visible: p.visible });
        }
      });
      return saved.filter(function(l) {
        if (map.layers[l.name] || self.cloudLayerMeta[l.name]) return true;
        return self.pendingSavedLayers.some(function(p) { return p.name === l.name; });
      });
    };

    var loadedTiles = 0, totalTiles = 0, layerRedrawNeeded = false;

    // Setup map layers state
    var layerKeys = Object.keys(map.layers);
    if (options && options.layers) {
      options.layers.forEach(oldLayer => {
        if (layerKeys.indexOf(oldLayer.name) != -1) {
          self.mapLayers.push(oldLayer);
          layerKeys.splice(layerKeys.indexOf(oldLayer.name), 1);
        } else {
          self.pendingSavedLayers.push({ name: oldLayer.name, visible: !!oldLayer.visible });
        }
      });
      var isBlankLayer = self.mapLayers.length == 0;
      layerKeys.forEach(layerKey => self.mapLayers.push({ name: layerKey, visible: isBlankLayer ? (map.default_layers.indexOf(layerKey) != -1) : false }));
    } else {
      layerKeys.forEach(layerKey => self.mapLayers.push({ name: layerKey, visible: (map.default_layers.indexOf(layerKey) != -1) }));
    }

var layerToggler = createLayerToggler(omGroup, !this.hidden, map.title, intent => {
      self.setManualVisibility(intent);
    });
    this.togglerNode = layerToggler; // FIX: Expose the Waze menu toggler for sorting!

    // --- 2. UTILITY HELPER FUNCTIONS ---
    function createIconButton(icon, titleText, forceTooltip) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fa ' + icon + ' open-maps-icon-button';
      if (titleText) {
        btn.setAttribute('aria-label', titleText);
        btn.dataset.container = '#sidebar';
        Tooltips.add(btn, titleText, forceTooltip);
      }
      return btn;
    }

    function createOrangeExclaimButton(tooltipText, forceTooltip) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fa fa-exclamation-circle open-maps-icon-button open-maps-orange-exclaim-circle-btn';
      if (tooltipText) {
        btn.setAttribute('aria-label', tooltipText);
        btn.dataset.container = '#sidebar';
        Tooltips.add(btn, tooltipText, forceTooltip);
      }
      return btn;
    }

function updateTileLoader() {
      const layerBars = UI.container.querySelectorAll('.open-maps-layer-progress-bar');
      if (loadedTiles === totalTiles || totalTiles === 0) {
        loadedTiles = 0; totalTiles = 0;
        UI.progressBar.style.opacity = '0';
        layerBars.forEach(bar => bar.style.opacity = '0');
        setTimeout(() => {
          if (totalTiles === 0) {
            UI.progressBar.style.width = '0%';
            layerBars.forEach(bar => bar.style.width = '0%');
          }
        }, 300);
      } else {
        const percentage = Math.floor((loadedTiles / totalTiles) * 100);
        UI.progressBar.style.opacity = '1';
        UI.progressBar.style.width = `${percentage}%`;
        layerBars.forEach(bar => {
          // FIX: Only animate the progress bar if the layer is actually toggled ON!
          const layerState = self.mapLayers.find(l => l.name === bar.dataset.layerName);
          if (layerState && layerState.visible) {
            bar.style.opacity = '1';
            bar.style.width = `${percentage}%`;
          } else {
            bar.style.opacity = '0';
            bar.style.width = '0%';
          }
        });
      }
    }

   this.clearError = function() {
      Tooltips.remove(UI.error);
      UI.error.style.display = 'none';
    };


    // --- 3. UI GENERATORS ---
  function openMapsMapHasZoomMeta(m) {
    var wmsFloorRaw = m.wmsMinEffectiveZoom != null ? m.wmsMinEffectiveZoom : m.minEffectiveZoom;
    var hasFloor = m.type === 'WMS' && wmsFloorRaw != null && wmsFloorRaw !== '';
    return !!(m.zoomRange || hasFloor);
  }

  function buildMainCard() {
      UI.container = document.createElement('wz-card');
      UI.container.className = 'result maps-menu-item list-item-card';
      UI.container.dataset.mapId = map.id; // FIX: Tag the container for the sort engine!

      UI.topRow = document.createElement('div');
      UI.topRow.className = 'open-maps-card-header';
      UI.topRow.style.position = 'relative';
      UI.topRow.style.overflow = 'hidden';
var handle = document.createElement('div');
      handle.className = 'open-maps-drag-handle';
      handle.style.cssText = 'width:32px; margin-right:8px; display:flex; justify-content:center;';

      self.bgColor = openMapsMapAvatarColorFromTitle(map.title);
      var bgColor = self.bgColor;

      // 2. SMART TEXT EXTRACTION
      var cleanName = map.title.replace(/[^a-zA-Z0-9 \-]/g, '').trim();
      var words = cleanName.split(/[\s\-]+/);
      var initials = (words[0].length >= 2 && words[0].length <= 4) ? words[0].toUpperCase() : (words.length >= 2 ? words[0][0] + words[1][0] : cleanName.substring(0, 2)).toUpperCase();

      function createAvatarElement(content, isIcon) {
        var fontSize = isIcon ? '16px' : (content.length > 2 ? '10px' : '14px');
        var div = document.createElement('div');
        div.dataset.activeColor = bgColor;
        div.style.cssText = 'width:32px; height:32px; border-radius:50%; color:#fff; font-size:' + fontSize + '; line-height:1; font-family:system-ui, sans-serif; font-weight:700; display:flex; align-items:center; justify-content:center; box-sizing:border-box; box-shadow:0 1px 3px rgba(0,0,0,0.3); pointer-events:none; transition: background-color 0.2s ease, filter 0.2s ease;';
        div.innerHTML = content;
        return div;
      }

      // --- BADGE WRAPPER (Holds Avatar + Flag) ---
      var badgeWrapper = document.createElement('div');
      badgeWrapper.style.cssText = 'position:relative; display:inline-block; width:32px; height:32px;';

      if (map.favicon) {
        UI.badge = createAvatarElement('', false);
        var img = document.createElement('img');
        img.src = 'https://s2.googleusercontent.com/s2/favicons?domain=' + map.url.split('/')[2] + '&sz=32';
        img.style.cssText = 'width:24px; height:24px; border-radius:4px; object-fit:contain; background-color:#fff; padding:1px; margin:auto;';
        img.onerror = function() { UI.badge.innerHTML = initials; };
        UI.badge.appendChild(img);
      } else if (map.icon) {
        UI.badge = createAvatarElement('<i class="fa ' + map.icon + '"></i>', true);
      } else {
        UI.badge = createAvatarElement(initials, false);
      }
      badgeWrapper.appendChild(UI.badge);

      // --- OVERLAY FLAG ---
      if (map.area && map.area !== 'user') {
        var flagImg = document.createElement('img');
        flagImg.src = 'https://flagcdn.com/16x12/' + map.area.toLowerCase() + '.png';
        var flagTip = I18n.t('openmaps.areas.' + map.area) || map.area;
        flagImg.setAttribute('aria-label', flagTip);
        Tooltips.add(flagImg, flagTip);
        flagImg.style.cssText = 'position:absolute; bottom:-2px; right:-6px; width:16px; height:12px; border-radius:2px; box-shadow:0 1px 3px rgba(0,0,0,0.6); border:1px solid #fff; z-index:2; pointer-events:auto; background:#fff;';
        badgeWrapper.appendChild(flagImg);
      }
      handle.appendChild(badgeWrapper);
      UI.topRow.appendChild(handle);

      var textContainer = document.createElement('div');
      textContainer.className = 'open-maps-text-container';
      textContainer.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; justify-content:center; min-width:0; flex:1;';

      UI.title = document.createElement('div');
      UI.title.className = 'open-maps-title';
      UI.title.style.cssText = 'cursor:pointer; font-weight:normal; font-size:13px; color:var(--content_primary, #3c4043); white-space:normal; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.2;';
      UI.title.textContent = map.title;
      UI.title.addEventListener('click', () => { UI.visibility.dispatchEvent(new MouseEvent('click')); });

      textContainer.appendChild(UI.title);
      UI.topRow.appendChild(textContainer);

      
      var buttons = document.createElement('div');
      buttons.className = 'buttons';

      UI.touPendingBtn = createOrangeExclaimButton(I18n.t('openmaps.tou_pending_hint'), true);
      UI.touPendingBtn.style.display = (map.touId !== 'none' && TOU_REGISTRY[map.touId] && !isTouAccepted(map.touId)) ? 'flex' : 'none';
      UI.touPendingBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        UI.editContainer.style.display = 'block';
        UI.editBtn.style.transform = 'rotate(180deg)';
        if (UI.touDetails) UI.touDetails.open = true;
      });
      buttons.appendChild(UI.touPendingBtn);

      UI.noLayersWarningBtn = createOrangeExclaimButton(I18n.t('openmaps.no_layers_enabled_hint'), true);
      UI.noLayersWarningBtn.style.display = 'none';
      UI.noLayersWarningBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        UI.editContainer.style.display = 'block';
        UI.editBtn.style.transform = 'rotate(180deg)';
        var layerDetails = Array.prototype.slice.call(UI.editContainer.querySelectorAll('details')).find(function(d) {
          return d.querySelector('.openmaps-map-list');
        });
        if (layerDetails) layerDetails.open = true;
      });
      buttons.appendChild(UI.noLayersWarningBtn);

      UI.error = createIconButton('fa-exclamation-triangle', I18n.t('openmaps.retrieving_error'), true);
      UI.error.style.color = 'red'; UI.error.style.display = 'none';
      UI.error.addEventListener('click', self.clearError);
      buttons.appendChild(UI.error);

      UI.info = createIconButton('fa-info-circle', I18n.t('openmaps.layer_out_of_range'), true);
      if (openMapsMapHasZoomMeta(map)) {
        Tooltips.remove(UI.info);
        Tooltips.add(UI.info, I18n.t('openmaps.zoom_meta_tooltip'), true);
      }
      buttons.appendChild(UI.info);

    // --- ZOOM TO BBOX BUTTON ---
      UI.zoomToBboxBtn = createIconButton('fa-crosshairs', I18n.t('openmaps.zoom_to_map_area'), true);
      UI.zoomToBboxBtn.style.display = 'none'; // Hidden by default
UI.zoomToBboxBtn.addEventListener('click', function(e) {
        e.stopPropagation();

        Tooltips.hide(this);

        if (self.area) {
          var bboxExtent = self.area;
          setTimeout(function() {
            var olMap = W.map.getOLMap();
            if (!olMap || !bboxExtent) return;
            olMap.zoomToExtent(bboxExtent);
            var z = W.map.getZoom();
            if (z < 12) {
              if (typeof W.map.setZoom === 'function') { W.map.setZoom(12); }
              else { olMap.zoomTo(12); }
            }
          }, 0);
        }
      });
      buttons.appendChild(UI.zoomToBboxBtn);
      // ---------------------------


    if (map.queryable) {
        // FIX: Attach to UI object so we can hide/show it later!
        UI.queryBtn = createIconButton('fa-hand-pointer-o', I18n.t('openmaps.query_layer'));
        UI.queryBtn.addEventListener('click', function() {
          if (!getFeatureInfoControl.active) {
            this.style.color = 'blue';
            var queryLayers = self.mapLayers.filter(l => l.visible && getLayerMeta(l.name).queryable).map(l => l.name);
            getFeatureInfoControl.params = { url: map.queryUrl || map.url, id: map.id, layers: queryLayers.join(), callback: () => UI.queryBtn.style.color = '' };
            getFeatureInfoControl.activate();
          } else {
            this.style.color = ''; getFeatureInfoControl.deactivate();
          }
        });
        buttons.appendChild(UI.queryBtn);
      }

      if (map.getExternalUrl) {
        var extLink = createIconButton('fa-external-link-square', I18n.t('openmaps.external_link_tooltip'));
        extLink.addEventListener('click', () => window.open(map.getExternalUrl(getMapExtent()), '_blank'));
        buttons.appendChild(extLink);
      }

// --- SMART VISIBILITY TOGGLE ---
      var lockIcon = !isTouAccepted(map.touId) ? 'fa-lock' : (self.hidden ? 'fa-eye-slash' : 'fa-eye');
      UI.visibility = createIconButton(lockIcon, !isTouAccepted(map.touId) ? I18n.t('openmaps.visibility_locked_tou') : I18n.t('openmaps.hideshow_layer'));

      if (!isTouAccepted(map.touId)) {
        UI.visibility.style.color = '#d93025'; // Make lock red
      }

      UI.visibility.addEventListener('click', function(e) {
        if (e) e.stopPropagation();

        if (!isTouAccepted(map.touId)) {
          // Force open the edit panel AND ensure the ToU section is visible!
          UI.editContainer.style.display = 'block';
          if (UI.touDetails) UI.touDetails.open = true;
          return;
        }

        // If the map is currently hidden (true), pass 'true' to tell the controller we want it visible!
        self.setManualVisibility(self.hidden);
      });
      buttons.appendChild(UI.visibility);

      var favBtn = createIconButton(isMapFavorite(map.id) ? 'fa-star' : 'fa-star-o', isMapFavorite(map.id) ? I18n.t('openmaps.favorite_remove') : I18n.t('openmaps.favorite_add'));
      favBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var wasFav = isMapFavorite(map.id);
        setMapFavorite(map.id, !wasFav);
        favBtn.classList.remove('fa-star', 'fa-star-o');
        favBtn.classList.add(!wasFav ? 'fa-star' : 'fa-star-o');
        Tooltips.remove(favBtn);
        var tip = !wasFav ? I18n.t('openmaps.favorite_remove') : I18n.t('openmaps.favorite_add');
        Tooltips.add(favBtn, tip);
        favBtn.setAttribute('aria-label', tip);
        if (addMapSuggestions.style.display === 'block') {
          populateAddMapSuggestions(addMapInput.value);
        }
        applyActiveMapsFilter();
      });
      buttons.appendChild(favBtn);

UI.editBtn = createIconButton('fa-chevron-down', I18n.t('openmaps.map_options_toggle'));
      UI.editBtn.style.transition = 'transform 0.2s ease';
      UI.editBtn.addEventListener('click', function() {
        var isHidden = UI.editContainer.style.display == 'none';
        UI.editContainer.style.display = isHidden ? 'block' : 'none';
        this.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
      });
      buttons.appendChild(UI.editBtn);

      UI.topRow.appendChild(buttons);

      UI.progressBar = document.createElement('div');
      UI.progressBar.style.cssText = 'position:absolute; bottom:0; left:0; height:3px; width:0%; background-color:#267bd8; transition:width 0.2s ease-out, opacity 0.3s; opacity:0; z-index:10;';
      UI.topRow.appendChild(UI.progressBar);

      UI.container.appendChild(UI.topRow);
      handleList.appendChild(UI.container);
    }

  function buildEditPanel() {
      UI.editContainer = document.createElement('div');
      UI.editContainer.className = 'edit-panel';
      UI.editContainer.style.display = 'none';

// --- CLEAN METADATA HEADER ---
      var metaBox = document.createElement('div');
      metaBox.style.cssText = 'margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e8eaed; font-size: 11px; color: #5f6368; line-height: 1.4;';

      var metaTop = document.createElement('div');
      // If this is a WMS URL, indicate which viewport-feature backend Map Inspector will use.
      // (ArcGIS REST-backed WMS → /MapServer/<id>/query; GeoServer WMS → WFS GetFeature.)
      // Keep it compact: just append a small tag after the Type chip (no extra label).
      var inspectorBackendChip = '';
      if (map.type === 'WMS' && map.url) {
        try {
          var u = String(map.url);
          var s = u.replace(/\/+$/, '').split('?')[0];
          var inspectorLabel = null;
          var compactLabel = null;

          if (openMapsArcgisRestBaseFromWmsUrl(u)) {
            inspectorLabel = I18n.t('openmaps.inspector_wms_arcgis_viewport'); // "WMS (ArcGIS REST)"
            compactLabel = 'ArcGIS REST';
          } else {
            var path = s.replace(/\/+$/, '');
            var isGeoServer = path.toLowerCase().indexOf('geoserver') !== -1;
            var endsWithWms = /\/wms$/i.test(path);
            if (isGeoServer && endsWithWms) {
              inspectorLabel = I18n.t('openmaps.inspector_wms_wfs_viewport'); // "WMS (GeoServer WFS)"
              compactLabel = 'GeoServer';
            }
          }

          if (inspectorLabel && compactLabel) {
            var titleEsc = openMapsEscapeForHtmlTooltip(inspectorLabel)
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
            inspectorBackendChip =
              ' ' +
              '<span style="background:#e8eaed; padding:1px 4px; border-radius:3px; color:#3c4043; border: 1px solid #dadce0;" title="' + titleEsc + '">' +
              compactLabel +
              '</span>';
          }
        } catch (e) {}
      }

      metaTop.innerHTML =
        '<strong>' + I18n.t('openmaps.meta_type') + ':</strong> ' +
        '<span style="background:#e8eaed; padding:1px 4px; border-radius:3px; color:#3c4043; border: 1px solid #dadce0;">' + (map.type || 'WMS') + '</span>' +
        inspectorBackendChip +
        ' &nbsp;|&nbsp; <strong>' + I18n.t('openmaps.meta_region') + ':</strong> ' + (I18n.t('openmaps.areas.' + map.area) || map.area);
      metaBox.appendChild(metaTop);

 // PERMANENT BBOX DISPLAY (Monospace for easy visual comparison)
      if (map.bbox) {
        var metaBbox = document.createElement('div');
        metaBbox.style.cssText = 'margin-top: 4px; font-family: monospace; font-size: 10px; color: #5f6368; user-select: all;';

        // Bulletproof extraction (Defends against Waze secretly converting arrays into OpenLayers objects)
        var bLeft = parseFloat(map.bbox.left !== undefined ? map.bbox.left : map.bbox[0]).toFixed(4);
        var bBottom = parseFloat(map.bbox.bottom !== undefined ? map.bbox.bottom : map.bbox[1]).toFixed(4);
        var bRight = parseFloat(map.bbox.right !== undefined ? map.bbox.right : map.bbox[2]).toFixed(4);
        var bTop = parseFloat(map.bbox.top !== undefined ? map.bbox.top : map.bbox[3]).toFixed(4);

        metaBbox.innerHTML = '<strong>' + I18n.t('openmaps.meta_bbox') + ':</strong> [' + bLeft + ', ' + bBottom + ', ' + bRight + ', ' + bTop + ']';
        metaBox.appendChild(metaBbox);
      }
      if (openMapsMapHasZoomMeta(map)) {
        UI.zoomMetaLine = document.createElement('div');
        UI.zoomMetaLine.style.cssText = 'margin-top: 4px; font-size: 10px; color: #70757a; line-height: 1.35; font-family: monospace, monospace;';
        metaBox.appendChild(UI.zoomMetaLine);
        Tooltips.add(UI.zoomMetaLine, I18n.t('openmaps.zoom_meta_tooltip'), true);
      }
      if (map.abstract) {
          var metaDesc = document.createElement('div');
          metaDesc.style.cssText = 'margin-top: 6px; font-style: italic; color: #70757a;';
          metaDesc.textContent = map.abstract;
          metaBox.appendChild(metaDesc);
      }
      UI.editContainer.appendChild(metaBox);

      if (map.type === 'WMS' && map.url && openMapsArcgisRestBaseFromWmsUrl(map.url)) {
        var probeWrap = document.createElement('div');
        probeWrap.style.cssText = 'margin: 8px 0 4px; padding: 6px 8px; border: 1px solid #dadce0; border-radius: 8px; background: #f8f9fa;';
        var probeCb = document.createElement('wz-checkbox');
        probeCb.checked = self.wmsArcgisRestViewportProbe !== false;
        probeCb.textContent = I18n.t('openmaps.wms_arcgis_rest_viewport_probe');
        probeCb.addEventListener('change', function() {
          self.wmsArcgisRestViewportProbe = !!probeCb.checked;
          saveMapState();
          if (openMapsInspectorApi) openMapsInspectorApi.notifyHandlesChanged();
        });
        Tooltips.add(probeCb, I18n.t('openmaps.wms_arcgis_rest_viewport_probe_tooltip'), true);
        probeWrap.appendChild(probeCb);
        UI.editContainer.appendChild(probeWrap);
      }

      // -----------------------------

      // --- VISUAL ADJUSTMENTS (opacity, bbox, improve + filters) ---
      var advColors = document.createElement('details');
      advColors.style.cssText = 'margin-top:10px; border:1px solid #dadce0; border-radius:8px; padding:5px; background:#f8f9fa;';
      var summary = document.createElement('summary');
      summary.style.cssText = 'font-weight:600; cursor:pointer; padding:5px; color:#3c4043; outline:none;';
      summary.innerHTML = '<i class="fa fa-sliders" style="margin-right:5px; color:#5f6368;" aria-hidden="true"></i>' + I18n.t('openmaps.visual_adjustments');
      advColors.appendChild(summary);

      var slidersContainer = document.createElement('div');
      slidersContainer.style.cssText = 'padding:10px; display:flex; flex-direction:column; gap:10px;';

      var visualCommonBox = document.createElement('div');
      visualCommonBox.style.cssText = 'display:flex; flex-direction:column; gap:10px;';

      var isEsriFeatureVector = map.type === 'ESRI_FEATURE' || map.type === 'GOOGLE_MY_MAPS';
      var hideBboxOption = map.area === 'UN' || map.type === 'GOOGLE_MY_MAPS';

      if (map.format != 'image/jpeg' && !isEsriFeatureVector) {
        var transCheck = document.createElement('wz-checkbox');
        transCheck.checked = self.transparent; transCheck.textContent = I18n.t('openmaps.transparent_label');
        transCheck.addEventListener('change', function() {
          self.transparent = !self.transparent;
          if (self.layer && typeof self.layer.mergeNewParams === 'function') {
            try { self.layer.mergeNewParams({ transparent: self.transparent }); } catch (eT) {}
          }
          saveMapState();
        });
        Tooltips.add(transCheck, I18n.t('openmaps.transparent_label_tooltip'));
        visualCommonBox.appendChild(transCheck);
      }

      // Pixel manipulations UI is appended below the common visual controls (sliders, blend mode, invert, reset).

      if (!hideBboxOption) {
        var bboxCheck = document.createElement('wz-checkbox');
        bboxCheck.checked = self.displayBbox;
        bboxCheck.textContent = I18n.t('openmaps.draw_bbox_on_map');
        bboxCheck.addEventListener('change', (e) => {
          self.displayBbox = e.target.checked;
          self.updateBboxLayer();
          saveMapState();
        });
        visualCommonBox.appendChild(bboxCheck);
      }

      if (!isEsriFeatureVector) {
        var opacityBox = document.createElement('div');
        opacityBox.style.cssText = 'display:flex; align-items:center; gap:8px; font-size:11px; color:#5f6368;';
        Tooltips.add(opacityBox, I18n.t('openmaps.opacity_label_tooltip'));

        var opLabel = document.createElement('span');
        opLabel.textContent = I18n.t('openmaps.opacity_label') + ':';
        opacityBox.appendChild(opLabel);

        var opSlider = document.createElement('input');
        opSlider.type = 'range'; opSlider.max = 100; opSlider.min = 5; opSlider.step = 5; opSlider.value = self.opacity;
        opSlider.style.cssText = 'flex:1; min-width:80px; margin:0; accent-color:#0099ff; cursor:pointer;';

        var opVal = document.createElement('span');
        opVal.textContent = self.opacity + '%';
        opVal.style.cssText = 'font-weight:bold; min-width:35px; color:#3c4043;';

        opSlider.addEventListener('input', function() {
          if (self.layer && typeof self.layer.setOpacity === 'function') {
            self.layer.setOpacity(Math.max(5, Math.min(100, this.value)) / 100);
          }
          self.opacity = this.value;
          opVal.textContent = this.value + '%';
        });
        opSlider.addEventListener('change', function() { saveMapState(); });

        opacityBox.appendChild(opSlider);
        opacityBox.appendChild(opVal);
        visualCommonBox.appendChild(opacityBox);
      }

      if (!isEsriFeatureVector) {
        function createSlider(label, prop, min, max, unit) {
          var row = document.createElement('div');
          row.style.cssText = 'display:flex; flex-direction:column;';
          var labelEl = document.createElement('div');
          labelEl.style.cssText = 'display:flex; justify-content:space-between; font-size:11px; color:#5f6368;';
          labelEl.innerHTML = `<span>${label}</span><span id="val-${prop}-${map.id}">${self[prop]}${unit}</span>`;

          var slider = document.createElement('input');
          slider.type = 'range'; slider.min = min; slider.max = max; slider.value = self[prop];
          slider.style.cssText = 'width:100%; cursor:pointer; accent-color:#0099ff;';
          slider.addEventListener('input', (e) => {
            self[prop] = e.target.value;
            document.getElementById(`val-${prop}-${map.id}`).textContent = e.target.value + unit;
            self.applyFilters();
          });
          slider.addEventListener('change', () => saveMapState());

          row.appendChild(labelEl);
          row.appendChild(slider);
          return {row, slider};
        }

        var sBright = createSlider(I18n.t('openmaps.slider_brightness'), 'brightness', 0, 200, '%');
        var sContrast = createSlider(I18n.t('openmaps.slider_contrast'), 'contrast', 0, 200, '%');
        var sSaturate = createSlider(I18n.t('openmaps.slider_saturation'), 'saturate', 0, 300, '%');
        var sHue = createSlider(I18n.t('openmaps.slider_hue_rotate'), 'hue', 0, 360, '°');
        var sGamma = createSlider(I18n.t('openmaps.slider_gamma'), 'gamma', 10, 200, '%');
// --- BLEND MODE DROPDOWN ---
        var blendRow = document.createElement('div');
        blendRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#5f6368; margin-top:4px; margin-bottom:4px;';

        var blendLabel = document.createElement('span');
        blendLabel.textContent = I18n.t('openmaps.blend_mode_label') + ':';

        var blendSelect = document.createElement('select');
        blendSelect.style.cssText = 'width:60%; padding:2px; font-size:11px; border-radius:4px; border:1px solid #dadce0; cursor:pointer; outline:none; background:#fff;';

        var modes = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
        modes.forEach(mode => {
          var opt = document.createElement('option');
          opt.value = mode;
          opt.textContent = mode.split('-').map(function(part) { return part.charAt(0).toUpperCase() + part.slice(1); }).join(' ');
          if (mode === self.blendMode) opt.selected = true;
          blendSelect.appendChild(opt);
        });

        blendSelect.addEventListener('change', (e) => {
          self.blendMode = e.target.value;
          self.applyFilters();
          saveMapState();
        });

        blendRow.appendChild(blendLabel);
        blendRow.appendChild(blendSelect);
        visualCommonBox.appendChild(blendRow);
        // -----------------------------
        var invRow = document.createElement('div');
        invRow.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px;';
        var invCheck = document.createElement('wz-checkbox');
        invCheck.textContent = I18n.t('openmaps.invert_colors');
        invCheck.checked = self.invert;
        invCheck.addEventListener('change', (e) => { self.invert = e.target.checked; self.applyFilters(); saveMapState(); });
        invRow.appendChild(invCheck);

        var resetBtn = createIconButton('fa-undo', I18n.t('openmaps.reset_visual_default'), true);
        resetBtn.addEventListener('click', function(e) {
          if (e && e.preventDefault) e.preventDefault();
          if (e && e.stopPropagation) e.stopPropagation();
          self.brightness = 100; self.contrast = 100; self.saturate = 100; self.hue = 0; self.gamma = 100; self.invert = false;
          [sBright, sContrast, sSaturate, sHue, sGamma].forEach(s => {
              var p = s.slider.previousSibling.lastChild.id.split('-')[1];
              s.slider.value = self[p];
              document.getElementById(s.slider.previousSibling.lastChild.id).textContent = self[p] + (p==='hue'?'°':(p==='blur'?'px':'%'));
          });
          invCheck.checked = false;
          self.blendMode = 'normal'; blendSelect.value = 'normal';
          self.applyFilters(); saveMapState();
        });
        invRow.appendChild(resetBtn);

        [sBright.row, sContrast.row, sSaturate.row, sHue.row, sGamma.row, invRow].forEach(el => visualCommonBox.appendChild(el));
      }

      if (visualCommonBox.childNodes.length > 0) {
        slidersContainer.appendChild(visualCommonBox);
        advColors.appendChild(slidersContainer);
        UI.editContainer.appendChild(advColors);
      }

      // --- PIXEL MANIPULATIONS (top-level sibling section; raster/tile only) ---
      if (!isEsriFeatureVector) {
      function ensureLayerHasCrossOriginIfNeeded() {
        // Mirror updateLayers() CORS gating so enabling this feature after the layer exists still works.
        var wantsPixelManipulation = !!map.pixelManipulations || !!self.improveMap || (self.pixelManipulationsOverride !== null);
        if (!wantsPixelManipulation) return;
        if (self.__openmapsTileCrossOrigin) return;
        if (self.layer) {
          try { W.map.removeLayer(self.layer); } catch (e) {}
          self.layer = null;
        }
        self.updateLayers();
      }

      var pmDetails = document.createElement('details');
      pmDetails.style.cssText = 'margin-top:10px; border:1px solid #dadce0; border-radius:8px; padding:5px; background:#f8f9fa;';

      var pmSummary = document.createElement('summary');
      pmSummary.style.cssText = 'font-weight:600; cursor:pointer; padding:5px; color:#3c4043; outline:none;';
      pmSummary.innerHTML = '<i class="fa fa-magic" style="margin-right:5px; color:#5f6368;" aria-hidden="true"></i>' + I18n.t('openmaps.pixel_manipulations_title');
      pmDetails.appendChild(pmSummary);

      var pixelManipulationsSection = document.createElement('div');
      pixelManipulationsSection.style.cssText = 'padding:10px; display:flex; flex-direction:column; gap:8px;';

      var impCheck = document.createElement('wz-checkbox');
      impCheck.checked = !!self.improveMap;
      impCheck.textContent = I18n.t('openmaps.map_improvement_label');
      impCheck.addEventListener('change', () => {
        self.improveMap = !self.improveMap;
        ensureLayerHasCrossOriginIfNeeded();
        if (self.layer) self.layer.redraw();
        saveMapState();
      });
      Tooltips.add(impCheck, I18n.t('openmaps.map_improvement_label_tooltip'));
      pixelManipulationsSection.appendChild(impCheck);

      var pmInfo = document.createElement('div');
      pmInfo.style.cssText = 'font-size:11px; color:#70757a; line-height:1.35;';
      pmInfo.textContent = I18n.t('openmaps.map_improvement_label_tooltip');
      pixelManipulationsSection.appendChild(pmInfo);

      var pmInfo2 = document.createElement('div');
      pmInfo2.style.cssText = 'font-size:11px; color:#70757a; line-height:1.35;';
      pmInfo2.textContent = I18n.t('openmaps.pixel_manipulations_tooltip');
      pixelManipulationsSection.appendChild(pmInfo2);

      var pmBox = document.createElement('div');
      pmBox.style.cssText = 'margin-top:0; padding:0; border:none; border-radius:0; background:transparent;';

      var pmHeader = document.createElement('div');
      pmHeader.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;';

      var pmTitle = document.createElement('div');
      pmTitle.style.cssText = 'font-weight:600; font-size:12px; color:#3c4043;';
      pmTitle.textContent = I18n.t('openmaps.pixel_manipulations_title');
      Tooltips.add(pmTitle, I18n.t('openmaps.pixel_manipulations_tooltip'), true);

      var pmActions = document.createElement('div');
      pmActions.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;';

      var pmUseDefaultBtn = createIconButton('fa-undo', I18n.t('openmaps.pixel_manipulations_use_default_tooltip'), true);
      var pmSelectNoneBtn = createIconButton('fa-ban', I18n.t('openmaps.pixel_manipulations_select_none_tooltip'), true);
      pmActions.appendChild(pmUseDefaultBtn);
      pmActions.appendChild(pmSelectNoneBtn);

      pmHeader.appendChild(pmTitle);
      pmHeader.appendChild(pmActions);
      pmBox.appendChild(pmHeader);

      var defaultOps = openMapsNormalizePixelManipulations(map.pixelManipulations) || [];
      var defaultLine = document.createElement('div');
      defaultLine.style.cssText = 'font-size:11px; color:#70757a; margin-bottom:8px; line-height:1.35;';
      defaultLine.innerHTML = '<strong>' + I18n.t('openmaps.pixel_manipulations_default') + ':</strong> ' + (defaultOps.length ? defaultOps.join(', ') : '—');
      pmBox.appendChild(defaultLine);

      var overrideLine = document.createElement('div');
      overrideLine.style.cssText = 'font-size:11px; color:#70757a; margin-bottom:6px; line-height:1.35;';
      overrideLine.innerHTML = '<strong>' + I18n.t('openmaps.pixel_manipulations_override') + ':</strong>';
      pmBox.appendChild(overrideLine);

      var pmList = document.createElement('div');
      pmList.style.cssText = 'display:flex; flex-direction:column; gap:4px; max-height:160px; overflow:auto; padding-right:4px;';
      pmBox.appendChild(pmList);

      var ops = openMapsAvailablePixelManipulationOps();
      var pmChecksByOp = {};

      function currentSelectedOps() {
        var arr = [];
        ops.forEach(function(op) {
          var c = pmChecksByOp[op];
          if (c && c.checked) arr.push(op);
        });
        return arr;
      }

      function setChecksFromList(list) {
        var set = {};
        (list || []).forEach(function(x) { set[x] = true; });
        ops.forEach(function(op) {
          if (pmChecksByOp[op]) pmChecksByOp[op].checked = !!set[op];
        });
      }

      function applyOverrideAndRedraw(newOverride) {
        var wasNull = (self.pixelManipulationsOverride === null);
        self.pixelManipulationsOverride = (newOverride === null) ? null : openMapsNormalizePixelManipulations(newOverride);
        if (wasNull && self.pixelManipulationsOverride !== null) ensureLayerHasCrossOriginIfNeeded();
        if (self.layer) self.layer.redraw();
        saveMapState();
      }

      ops.forEach(function(op) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:8px;';
        var cb = document.createElement('wz-checkbox');
        cb.textContent = op;
        cb.checked = false;
        cb.addEventListener('change', function() {
          applyOverrideAndRedraw(currentSelectedOps());
        });
        pmChecksByOp[op] = cb;
        row.appendChild(cb);
        pmList.appendChild(row);
      });

      // Initialize checkbox state from effective list (override if present, else default).
      setChecksFromList(Array.isArray(self.pixelManipulationsOverride) ? self.pixelManipulationsOverride : defaultOps);

      pmUseDefaultBtn.addEventListener('click', function(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        applyOverrideAndRedraw(null);
        setChecksFromList(defaultOps);
      });
      pmSelectNoneBtn.addEventListener('click', function(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        applyOverrideAndRedraw([]);
        setChecksFromList([]);
      });

      pixelManipulationsSection.appendChild(pmBox);
      pmDetails.appendChild(pixelManipulationsSection);
      UI.editContainer.appendChild(pmDetails);
      }





  

      // Sub-Layers (WMS/ESRI: merged catalog from GetCapabilities / MapServer JSON)
      var mapLayersDetailsRoot = null;
      var subLayerContainer = null;
      function appendMapLayersSummaryInner(summaryEl) {
        summaryEl.textContent = '';
        var listIco = document.createElement('i');
        listIco.className = 'fa fa-list';
        listIco.style.cssText = 'margin-right:5px; color:#5f6368;';
        listIco.setAttribute('aria-hidden', 'true');
        summaryEl.appendChild(listIco);
        summaryEl.appendChild(document.createTextNode(I18n.t('openmaps.map_layers_title')));
        var layerWarn = document.createElement('i');
        layerWarn.className = 'fa fa-exclamation-circle open-maps-maplayers-summary-warning';
        layerWarn.setAttribute('aria-hidden', 'true');
        layerWarn.style.display = 'none';
        summaryEl.appendChild(layerWarn);
        UI.mapLayersNoActiveMark = layerWarn;
        Tooltips.add(layerWarn, I18n.t('openmaps.no_layers_enabled_hint'), true);
      }

      function appendOneLayerRow(layerItem, container) {
        var mapLayer = getLayerMeta(layerItem.name);
        var item = document.createElement('wz-card'); item.className = 'result maps-menu-item list-item-card layer-card';

        var lHeader = document.createElement('div'); lHeader.className = 'open-maps-card-header layer-card-header';
        lHeader.style.cssText = 'position:relative; overflow:visible; display:flex; align-items:center;';

        var lHandle = document.createElement('div');
        lHandle.className = 'open-maps-drag-handle layer-handle';
        lHandle.style.width = '24px';
        lHandle.style.marginRight = '6px';
        lHandle.style.display = 'flex';
        lHandle.style.justifyContent = 'center';

        var lHash = 0;
        for (var ti = 0; ti < mapLayer.title.length; ti++) {
          lHash = mapLayer.title.charCodeAt(ti) + ((lHash << 5) - lHash);
        }
        var wazeColors = [
          '#0099ff', '#8663df', '#20c063', '#ff9600', '#ff6699',
          '#0071c5', '#15ccb2', '#33ccff', '#e040fb', '#ffc000',
          '#f44336', '#3f51b5', '#009688', '#8bc34a', '#e91e63'
        ];
        var lBgColor = wazeColors[Math.abs(lHash) % wazeColors.length];
        var lCleanName = mapLayer.title.replace(/[^a-zA-Z0-9 \-]/g, '').trim();
        var lWords = lCleanName.split(/[\s\-]+/);
        var lInitials = (lWords.length >= 2 ? lWords[0][0] + lWords[1][0] : lCleanName.substring(0, 2)).toUpperCase();

        var lBadge = document.createElement('div');
        var activeColor = lBgColor + 'b3';
        var inactiveColor = '#c2c4c8';

        lBadge.style.cssText = 'width:24px; height:24px; border-radius:4px; color:#fff; font-size:11px; line-height:1; font-family:system-ui, -apple-system, BlinkMacSystemFont, Roboto, sans-serif; font-weight:700; display:flex; align-items:center; justify-content:center; box-sizing:border-box; box-shadow:0 1px 3px rgba(0,0,0,0.3); pointer-events:none; transition: background-color 0.2s ease;';
        lBadge.style.backgroundColor = layerItem.visible ? activeColor : inactiveColor;
        lBadge.textContent = lInitials;

        var layerBadgeWrap = document.createElement('div');
        layerBadgeWrap.style.cssText = 'position:relative; display:inline-block; width:24px; height:24px; flex-shrink:0;';
        layerBadgeWrap.appendChild(lBadge);
        var originKind = getLayerOriginKind(layerItem.name);
        var originIco = document.createElement('i');
        originIco.setAttribute('aria-hidden', 'true');
        var originFa = originKind === 'curated' ? 'fa-file-code-o' : (originKind === 'cloud' ? 'fa-cloud' : 'fa-question-circle');
        var originColor = originKind === 'curated' ? '#1a73e8' : (originKind === 'cloud' ? '#0f9d58' : '#f9a825');
        originIco.className = 'fa ' + originFa + ' open-maps-layer-origin-marker';
        originIco.style.cssText = 'position:absolute; bottom:-3px; right:-5px; width:16px; height:16px; border-radius:50%; background:#fff; border:1px solid #fff; box-shadow:0 1px 3px rgba(0,0,0,0.45); font-size:10px; line-height:1; display:flex; align-items:center; justify-content:center; z-index:2; pointer-events:auto; color:' + originColor + ';';
        var originTip = getLayerOriginTooltip(layerItem.name);
        originIco.setAttribute('aria-label', originTip);
        Tooltips.add(originIco, originTip, true);
        layerBadgeWrap.appendChild(originIco);
        lHandle.appendChild(layerBadgeWrap);

        lHeader.appendChild(lHandle);

        var lText = document.createElement('div'); lText.className = 'open-maps-text-container';
        var lTitle = document.createElement('p');
        lTitle.className = 'title layer-title';

        lTitle.style.cssText = 'cursor:pointer; font-weight:normal; white-space:normal; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; line-height:1.2;';
        lTitle.style.color = (layerItem.visible ? '' : '#999');
        lTitle.textContent = mapLayer.title;
        lText.appendChild(lTitle);

        var lDesc = document.createElement('div');
        if (mapLayer.abstract) {
          lDesc.className = 'additional-info'; lDesc.title = I18n.t('openmaps.expand'); lDesc.style.color = (layerItem.visible ? '' : '#999');
          lDesc.addEventListener('click', function() { this.title = (this.style.whiteSpace == 'nowrap' ? I18n.t('openmaps.collapse') : I18n.t('openmaps.expand')); this.style.whiteSpace = (this.style.whiteSpace == 'nowrap' || this.style.whiteSpace == '' ? 'normal' : 'nowrap'); });
          lDesc.textContent = mapLayer.abstract; lText.appendChild(lDesc);
        }
        lHeader.appendChild(lText);

        var lBtns = document.createElement('div'); lBtns.className = 'buttons';

        var lQuery = null;
        if (mapLayer.queryable) {
          lQuery = createIconButton('fa-hand-pointer-o', I18n.t('openmaps.query_layer'));
          lQuery.addEventListener('click', function() { this.style.color = 'blue'; getFeatureInfoControl.params = { url: map.url, id: map.id, layers: layerItem.name, callback: () => lQuery.style.color = '' }; getFeatureInfoControl.activate(); });
          lBtns.appendChild(lQuery);
        }

        var lVis = createIconButton((layerItem.visible ? 'fa-eye' : 'fa-eye-slash'), I18n.t('openmaps.hideshow_layer'));
        lVis.addEventListener('mouseenter', () => { lVis.classList.toggle('fa-eye', !layerItem.visible); lVis.classList.toggle('fa-eye-slash', layerItem.visible); });
        lVis.addEventListener('mouseleave', () => { lVis.classList.toggle('fa-eye', layerItem.visible); lVis.classList.toggle('fa-eye-slash', !layerItem.visible); });

        lVis.addEventListener('click', () => {
          layerItem.visible = !layerItem.visible;
          layerRedrawNeeded = true;
          self.updateLayers();
        });

        self.layerUI.push({
          item: layerItem, badge: lBadge, title: lTitle, desc: lDesc, queryBtn: lQuery,
          activeColor: activeColor, inactiveColor: inactiveColor
        });

        lTitle.addEventListener('click', () => { lVis.dispatchEvent(new MouseEvent('click')); lVis.classList.toggle('fa-eye'); lVis.classList.toggle('fa-eye-slash'); });
        lBtns.appendChild(lVis);
        lHeader.appendChild(lBtns);
        var lBar = document.createElement('div'); lBar.className = 'open-maps-layer-progress-bar';
        lBar.dataset.layerName = layerItem.name;
        lBar.style.cssText = 'position:absolute; bottom:0; left:0; height:2px; width:0%; background-color:#267bd8; transition:width 0.2s ease-out, opacity 0.3s; opacity:0; z-index:10;';
        lHeader.appendChild(lBar);

        item.appendChild(lHeader); container.appendChild(item);
      }

      function rebuildMapLayersUI() {
        if (!UI.mapLayersSubContainer) return;
        self.layerUI = [];
        while (UI.mapLayersSubContainer.firstChild) {
          UI.mapLayersSubContainer.removeChild(UI.mapLayersSubContainer.firstChild);
        }
        self.mapLayers.forEach(function(layerItem) {
          appendOneLayerRow(layerItem, UI.mapLayersSubContainer);
        });
        if (UI.orphanHintEl) {
          UI.orphanHintEl.style.display = self._orphanSavedLayersDropped > 0 ? 'block' : 'none';
          if (self._orphanSavedLayersDropped > 0) {
            var hintKey = self._orphanHintKind === 'local' ? 'openmaps.saved_layers_orphan_hint_local' : 'openmaps.saved_layers_orphan_hint';
            UI.orphanHintEl.textContent = I18n.t(hintKey).replace(/\{n\}/g, String(self._orphanSavedLayersDropped));
          }
        }
        layerRedrawNeeded = true;
        self.updateLayers();
      }

      function applyCatalogFromEntry(entry) {
        if (!entry || entry.status !== 'ok' || !entry.layers) return;
        var cloud = entry.layers;
        self.cloudLayerMeta = {};
        cloud.forEach(function(c) {
          self.cloudLayerMeta[c.name] = { title: c.title, queryable: !!c.queryable };
        });
        var cloudNames = cloud.map(function(c) { return c.name; });
        var prevMapLayers = self.mapLayers.slice();
        var vis = {};
        prevMapLayers.forEach(function(m) { vis[m.name] = m.visible; });
        var pending = self.pendingSavedLayers.slice();
        self.pendingSavedLayers = [];
        var orphans = 0;
        pending.forEach(function(p) {
          var match = cloudNames.indexOf(p.name) !== -1 ? p.name : null;
          if (!match) {
            for (var pi = 0; pi < cloudNames.length; pi++) {
              if (cloudNames[pi].toLowerCase() === p.name.toLowerCase()) { match = cloudNames[pi]; break; }
            }
          }
          if (match) vis[match] = p.visible;
          else orphans++;
        });
        self._orphanSavedLayersDropped = orphans;
        self._orphanHintKind = orphans > 0 ? 'server' : undefined;
        var curatedKeys = Object.keys(map.layers);
        var mergedNames = curatedKeys.slice();
        var extra = cloud.filter(function(c) { return curatedKeys.indexOf(c.name) === -1; })
          .sort(function(a, b) { return (a.title || a.name).localeCompare(b.title || b.name); });
        extra.forEach(function(c) { mergedNames.push(c.name); });
        self.mapLayers = mergedNames.map(function(name) {
          var v;
          if (Object.prototype.hasOwnProperty.call(vis, name)) v = vis[name];
          else {
            var prev = prevMapLayers.find(function(m) { return m.name === name; });
            v = prev ? prev.visible : (map.default_layers.indexOf(name) !== -1);
          }
          return { name: name, visible: v };
        });
        rebuildMapLayersUI();
        saveMapState();
      }

      function ensureLayerCatalogLoaded(forceRefresh, onDone) {
        if (willAwaitLayerCatalogNetwork(map, forceRefresh) && UI.layerCatalogLoadingEl) {
          UI.layerCatalogLoadingEl.style.display = 'flex';
        }
        fetchLayerCatalogSession(map, function(err, entry) {
          if (UI.layerCatalogLoadingEl) UI.layerCatalogLoadingEl.style.display = 'none';
          if (err || !entry || entry.status !== 'ok') {
            if (onDone) onDone(err, entry);
            return;
          }
          if (!self._layerCatalogAppliedOnce || forceRefresh) {
            applyCatalogFromEntry(entry);
            self._layerCatalogAppliedOnce = true;
          }
          if (onDone) onDone(err, entry);
        }, forceRefresh);
      }

      function openServerCapabilitiesViewer(opts) {
        var forceRefresh = opts && opts.forceRefresh;
        queryWindowTitle.textContent = I18n.t('openmaps.server_capabilities_title') + ': ' + map.title;
        queryWindowLoading.style.display = 'block';
        queryWindowContent.innerHTML = '';
        queryWindowOriginalContent.innerHTML = '';
        queryWindow.style.display = 'block';

        function fillFromEntry(entry) {
          queryWindowLoading.style.display = 'none';
          var capUrl = entry.capUrl || getCapabilitiesUrlForMap(map);
          var copier = createClipboardCopier(I18n.t('openmaps.server_capabilities_url_label'), capUrl, false);
          queryWindowContent.appendChild(copier);
          var pre = document.createElement('pre');
          pre.style.cssText = 'font-size:11px; white-space:pre-wrap; overflow-wrap:anywhere; box-sizing:border-box; width:100%; margin:0; background-color:#f8f9fa; padding:10px; border:1px solid #ccc; user-select:text; font-family:monospace; max-height:60vh; overflow-y:auto;';
          if (map.type === 'WMS') {
            pre.textContent = entry.raw || '';
          } else {
            try {
              var json = JSON.parse(entry.raw || '{}');
              pre.textContent = JSON.stringify(json, null, 2);
            } catch (e2) {
              pre.textContent = entry.raw || '';
            }
          }
          queryWindowContent.appendChild(pre);
        }

        var key = sessionLayerCatalogKey(map);
        var cached = sessionLayerCatalog[key];
        if (!forceRefresh && cached && cached.status === 'ok' && cached.raw) {
          fillFromEntry(cached);
          return;
        }
        fetchLayerCatalogSession(map, function(err, entry) {
          if (err || !entry || entry.status !== 'ok') {
            queryWindowLoading.style.display = 'none';
            queryWindowContent.innerHTML = '<div style="color:red; padding:10px; font-weight:bold;">' + I18n.t('openmaps.server_capabilities_error') + '</div>';
            return;
          }
          fillFromEntry(entry);
        }, forceRefresh);
      }

      var showLayerList = (map.type === 'WMS' || map.type === 'ESRI') ? (self.mapLayers.length >= 1) : (self.mapLayers.length > 1);

      if (showLayerList) {
        mapLayersDetailsRoot = document.createElement('details');
        mapLayersDetailsRoot.style.cssText = 'margin-top:10px; border:1px solid #dadce0; border-radius:8px; padding:5px; background:#f8f9fa;';
        var layersSummary = document.createElement('summary');
        layersSummary.style.cssText = 'font-weight:600; cursor:pointer; padding:5px; color:#3c4043; outline:none;';
        appendMapLayersSummaryInner(layersSummary);
        mapLayersDetailsRoot.appendChild(layersSummary);
        subLayerContainer = document.createElement('div');
        subLayerContainer.className = 'openmaps-map-list';
        UI.mapLayersSubContainer = subLayerContainer;
        UI.mapLayersDetailsRoot = mapLayersDetailsRoot;

        var orphanHint = document.createElement('div');
        orphanHint.className = 'open-maps-orphan-layers-hint';
        orphanHint.style.cssText = 'display:none; font-size:11px; color:#e37400; margin:6px 0 4px 0; line-height:1.3;';
        UI.orphanHintEl = orphanHint;
        mapLayersDetailsRoot.appendChild(orphanHint);
        if (map.type === 'WMS' || map.type === 'ESRI') {
          var catalogLoading = document.createElement('div');
          catalogLoading.className = 'open-maps-layer-catalog-loading';
          catalogLoading.setAttribute('role', 'status');
          catalogLoading.setAttribute('aria-live', 'polite');
          catalogLoading.style.cssText = 'display:none; align-items:center; gap:8px; font-size:11px; color:#5f6368; margin:4px 0 8px 0; padding:6px 8px; background:#e8f0fe; border-radius:6px; line-height:1.35; border:1px solid #dadce0;';
          var catalogSpin = document.createElement('i');
          catalogSpin.className = 'fa fa-spinner fa-spin';
          catalogSpin.setAttribute('aria-hidden', 'true');
          catalogLoading.appendChild(catalogSpin);
          var catalogLoadText = document.createElement('span');
          catalogLoadText.textContent = I18n.t('openmaps.layer_catalog_loading');
          catalogLoading.appendChild(catalogLoadText);
          UI.layerCatalogLoadingEl = catalogLoading;
          mapLayersDetailsRoot.appendChild(catalogLoading);
        }
        mapLayersDetailsRoot.appendChild(subLayerContainer);

        self.mapLayers.forEach(function(layerItem) {
          appendOneLayerRow(layerItem, subLayerContainer);
        });
        UI.editContainer.appendChild(mapLayersDetailsRoot);

        if (!subLayerContainer.dataset.omSortableInit) {
          sortable(subLayerContainer, { forcePlaceholderSize: true, placeholderClass: 'result', handle: '.open-maps-drag-handle' })[0].addEventListener('sortupdate', function(e) {
            if (e.detail.elementIndex < 0 || e.detail.elementIndex >= self.mapLayers.length || e.detail.oldElementIndex < 0 || e.detail.oldElementIndex >= self.mapLayers.length) return;
            self.mapLayers.splice(e.detail.elementIndex, 0, self.mapLayers.splice(e.detail.oldElementIndex, 1)[0]);
            layerRedrawNeeded = true;
            self.updateLayers();
          });
          subLayerContainer.dataset.omSortableInit = '1';
        }
      }

      if (map.type === 'WMS' || map.type === 'ESRI') {
        if (mapLayersDetailsRoot) {
          mapLayersDetailsRoot.addEventListener('toggle', function onLayersDetailsToggle() {
            if (!mapLayersDetailsRoot.open) return;
            ensureLayerCatalogLoaded(false, null);
          });
        }
        if (self.pendingSavedLayers.length > 0) {
          setTimeout(function() { ensureLayerCatalogLoaded(false, null); }, 0);
        }
      } else if (self.pendingSavedLayers.length > 0) {
        var droppedLocal = self.pendingSavedLayers.length;
        self._orphanSavedLayersDropped = droppedLocal;
        self._orphanHintKind = 'local';
        self.pendingSavedLayers = [];
        if (UI.orphanHintEl) {
          UI.orphanHintEl.style.display = 'block';
          UI.orphanHintEl.textContent = I18n.t('openmaps.saved_layers_orphan_hint_local').replace(/\{n\}/g, String(droppedLocal));
        } else {
          console.warn('[WME Open Maps] ' + I18n.t('openmaps.saved_layers_orphan_hint_local').replace(/\{n\}/g, String(droppedLocal)));
        }
        saveMapState();
      }
        // --- TERMS OF USE (collapsible section, same pattern as Visual adjustments / Map layers)
      if (map.touId !== 'none') {
        var isConfigValid = map.touId && TOU_REGISTRY[map.touId];
        var touUnlocked = isConfigValid ? isTouAccepted(map.touId) : false;

        var touDetails = document.createElement('details');
        touDetails.className = 'open-maps-tou-details';
        touDetails.style.cssText = 'margin-top:10px; border:1px solid #dadce0; border-radius:8px; padding:5px; background:#f8f9fa;';
        UI.touDetails = touDetails;

        var touSummary = document.createElement('summary');
        touSummary.style.cssText = 'font-weight:600; cursor:pointer; padding:5px; color:#3c4043; outline:none; display:flex; align-items:center; flex-wrap:wrap; gap:4px;';
        var touSummaryLeadIcon = document.createElement('i');
        touSummaryLeadIcon.className = 'fa fa-balance-scale';
        touSummaryLeadIcon.style.cssText = 'margin-right:4px; color:#5f6368;';
        touSummaryLeadIcon.setAttribute('aria-hidden', 'true');
        touSummary.appendChild(touSummaryLeadIcon);
        touSummary.appendChild(document.createTextNode(I18n.t('openmaps.terms_section_title')));
        var touSummaryStatus = document.createElement('span');
        touSummaryStatus.className = 'open-maps-tou-summary-status';
        touSummaryStatus.style.cssText = 'font-weight:600; margin-left:6px;';
        touSummary.appendChild(touSummaryStatus);
        touDetails.appendChild(touSummary);

        var touReadTermsProbeStatus = null;

        var touProbeUiState = 'checking';
        var touProbeVerifiedAt = 0;
        var touProbeFailDetail = '';

        function syncTouReadTermsProbeIndicator() {
          if (!touReadTermsProbeStatus) return;
          Tooltips.remove(touReadTermsProbeStatus);
          touReadTermsProbeStatus.innerHTML = '';
          if (!isConfigValid) {
            touReadTermsProbeStatus.style.display = 'none';
            return;
          }
          var stored = hasStoredTouAcceptance(map.touId);
          var sessOnly = !!touUnreachableSessionDismissed[map.touId] && !stored;
          if (stored || sessOnly) {
            touReadTermsProbeStatus.style.display = 'none';
            return;
          }
          touReadTermsProbeStatus.style.display = 'inline-block';
          if (touProbeUiState === 'checking') {
            touReadTermsProbeStatus.innerHTML = '<i class="fa fa-spinner fa-spin" style="color:#80868b;" aria-hidden="true"></i>';
            Tooltips.add(touReadTermsProbeStatus, I18n.t('openmaps.tou_link_probe_checking'), true);
          } else if (touProbeUiState === 'ok') {
            touReadTermsProbeStatus.innerHTML = '<i class="fa fa-check-circle" style="color:#5f8a6e;" aria-hidden="true"></i>';
            var whenStr = touProbeVerifiedAt ? new Date(touProbeVerifiedAt).toLocaleString() : '';
            Tooltips.add(touReadTermsProbeStatus, I18n.t('openmaps.tou_link_probe_ok').replace(/\{when\}/g, whenStr), true);
          } else if (touProbeUiState === 'fail') {
            touReadTermsProbeStatus.innerHTML = '<i class="fa fa-exclamation-triangle open-maps-tou-probe-fail-icon" aria-hidden="true"></i>';
            var d = touProbeFailDetail || '—';
            Tooltips.add(touReadTermsProbeStatus, I18n.t('openmaps.tou_link_probe_fail').replace(/\{detail\}/g, d), true);
          }
        }

        var updateLinkText = function() {
          if (!isConfigValid) {
            touSummaryStatus.innerHTML = '<i class="fa fa-exclamation-triangle" aria-hidden="true"></i> ' + I18n.t('openmaps.tou_config_error');
            touSummaryStatus.style.color = '#d93025';
          } else {
            var stored = hasStoredTouAcceptance(map.touId);
            var sessOnly = !!touUnreachableSessionDismissed[map.touId] && !stored;
            if (stored) {
              touSummaryStatus.innerHTML = '<i class="fa fa-check-square-o" aria-hidden="true"></i> ' + I18n.t('openmaps.tou_section_status_accepted');
              touSummaryStatus.style.color = '#0f9d58';
            } else if (sessOnly) {
              touSummaryStatus.innerHTML = '<i class="fa fa-exclamation-circle open-maps-orange-fa-inline open-maps-orange-fa-inline--gap" aria-hidden="true"></i> ' + I18n.t('openmaps.tou_section_status_dismissed');
              touSummaryStatus.style.color = '#e37400';
            } else {
              touSummaryStatus.style.color = '';
              touSummaryStatus.innerHTML = '<i class="fa fa-exclamation-circle open-maps-orange-fa-inline" aria-hidden="true"></i>';
              Tooltips.add(touSummaryStatus.firstElementChild, I18n.t('openmaps.tou_section_status_required'), true);
            }
          }
          syncTouReadTermsProbeIndicator();
        };
        updateLinkText();

        // 2. The Box Container (body of the Terms of Use section)
        var touBox = document.createElement('div');
        touBox.className = 'open-maps-tou-box';
        touBox.style.cssText = 'padding:10px; border-radius:8px; margin-top:4px; margin-bottom:4px;';
        touBox.style.background = '#fce8e6';
        touBox.style.border = '1px solid #fad2cf';

        var tTitle = document.createElement('div');
        tTitle.style.cssText = 'color:#333; margin-bottom:5px; font-size:12px; font-weight:bold;';
        touBox.appendChild(tTitle);

        var tDesc = document.createElement('div');
        tDesc.style.cssText = 'font-size:11px; color:#3c4043; margin-bottom:8px; line-height:1.3;';
        touBox.appendChild(tDesc);

        if (!isConfigValid) {
          // ERROR STATE: Map is missing a ToU definition
          tTitle.innerHTML = '<i class="fa fa-exclamation-triangle" style="color:#d93025;" aria-hidden="true"></i> ' + I18n.t('openmaps.tou_invalid_title');
          tDesc.textContent = I18n.t('openmaps.tou_invalid_body');
        } else {
          // NORMAL STATE
          var touObj = TOU_REGISTRY[map.touId];
          tTitle.textContent = touObj.name;
          function refreshTouPanelChrome() {
            var stored = hasStoredTouAcceptance(map.touId);
            var sessOnly = !!touUnreachableSessionDismissed[map.touId] && !stored;
            if (stored) {
              touBox.style.background = '#e6f4ea';
              touBox.style.border = '1px solid #ceead6';
              tDesc.textContent = I18n.t('openmaps.tou_desc_accepted');
            } else if (sessOnly) {
              touBox.style.background = '#fff8e1';
              touBox.style.border = '1px solid #fbc02d';
              tDesc.textContent = I18n.t('openmaps.tou_desc_dismissed');
            } else {
              touBox.style.background = '#fce8e6';
              touBox.style.border = '1px solid #fad2cf';
              tDesc.textContent = I18n.t('openmaps.tou_desc_required');
            }
            updateLinkText();
          }
          refreshTouPanelChrome();

          var touReachWarn = document.createElement('div');
          touReachWarn.style.cssText = 'display:none; margin-bottom:8px; padding:8px; border-radius:4px; background:#fff8e1; border:1px solid #fbc02d; font-size:11px; color:#5d4037; line-height:1.35;';
          touBox.appendChild(touReachWarn);

          var tLinkBox = document.createElement('div');
          tLinkBox.style.cssText = 'font-weight:bold; font-size:11px; margin-bottom:10px; color:#202124;';
          tLinkBox.appendChild(document.createTextNode(I18n.t('openmaps.tou_read_terms_in') + ' '));
          touReadTermsProbeStatus = document.createElement('span');
          touReadTermsProbeStatus.className = 'open-maps-tou-readterms-probe';
          touReadTermsProbeStatus.style.cssText = 'display:inline-block; margin-right:4px; min-width:14px; text-align:center; vertical-align:middle;';
          tLinkBox.appendChild(touReadTermsProbeStatus);

          var linksClicked = false;
          var touProbeUnreachable = false;
          var acceptBtn = document.createElement('wz-button');
          acceptBtn.className = 'openmaps-wz-btn-compact';
          acceptBtn.setAttribute('color', 'secondary');
          acceptBtn.setAttribute('size', 'sm');
          acceptBtn.disabled = true;
          acceptBtn.textContent = I18n.t('openmaps.tou_accept');
          acceptBtn.style.display = hasStoredTouAcceptance(map.touId) ? 'none' : 'inline-block';

          function refreshAcceptBtnTooltip() {
            Tooltips.remove(acceptBtn);
            if (acceptBtn.style.display === 'none') return;
            if (acceptBtn.disabled) {
              Tooltips.add(acceptBtn, I18n.t('openmaps.tou_accept_disabled_tooltip'), true, { container: 'body' });
            }
          }
          refreshAcceptBtnTooltip();

          Object.keys(touObj.links).forEach(lang => {
            var a = document.createElement('a');
            a.href = touObj.links[lang];
            a.target = '_blank';
            a.innerHTML = '<i class="fa fa-external-link" style="font-size:10px;"></i> [' + lang.toUpperCase() + ']';
            a.style.cssText = 'margin-left:5px; color:#1a73e8; cursor:pointer; text-decoration:none;';
            a.addEventListener('click', () => {
              if (!hasStoredTouAcceptance(map.touId) && !touProbeUnreachable) {
                linksClicked = true;
                acceptBtn.disabled = false;
                acceptBtn.setAttribute('color', 'positive');
                refreshAcceptBtnTooltip();
              }
            });
            tLinkBox.appendChild(a);
          });
touBox.appendChild(tLinkBox);
          syncTouReadTermsProbeIndicator();

          probeToUReachability(map.touId, function(res) {
            if (res.status === 'ok') {
              touProbeUiState = 'ok';
              touProbeVerifiedAt = Date.now();
              syncTouReadTermsProbeIndicator();
              return;
            }
            if (res.status === 'invalid') {
              touProbeUiState = 'fail';
              touProbeFailDetail = '—';
              syncTouReadTermsProbeIndicator();
              return;
            }
            touProbeUiState = 'fail';
            touProbeFailDetail = formatTouUnreachableDetail(res);
            syncTouReadTermsProbeIndicator();
            if (res.status !== 'unreachable') return;
            touProbeUnreachable = true;
            linksClicked = false;
            acceptBtn.disabled = true;
            acceptBtn.setAttribute('color', 'secondary');
            refreshAcceptBtnTooltip();
            touReachWarn.style.display = 'block';
            touReachWarn.textContent = '';
            var wTitle = document.createElement('div');
            wTitle.style.fontWeight = 'bold';
            wTitle.textContent = I18n.t('openmaps.tou_unreachable_title');
            var wDetail = document.createElement('div');
            wDetail.style.cssText = 'margin-top:4px; font-size:10px; opacity:0.95;';
            wDetail.textContent = formatTouUnreachableDetail(res) + I18n.t('openmaps.tou_unreachable_detail_suffix');
            var wHint = document.createElement('div');
            wHint.style.cssText = 'margin-top:6px; font-size:10px;';
            wHint.textContent = I18n.t('openmaps.tou_unreachable_hint');
            var wDismiss = document.createElement('wz-button');
            wDismiss.className = 'openmaps-wz-btn-compact';
            wDismiss.setAttribute('size', 'sm');
            wDismiss.setAttribute('color', 'secondary');
            wDismiss.textContent = I18n.t('openmaps.tou_dismiss_session');
            wDismiss.style.cssText = 'margin-top:8px;';
            wDismiss.addEventListener('click', function() {
              touReachWarn.style.display = 'none';
              touUnreachableSessionDismissed[map.touId] = true;
              window.dispatchEvent(new CustomEvent('om-tou-sync', { detail: { touId: map.touId, accepted: true, sessionUnreachableDismiss: true } }));
              self.setManualVisibility(true);
              setTimeout(function() {
                if (UI.touDetails) UI.touDetails.open = false;
              }, 1500);
            });
            touReachWarn.appendChild(wTitle);
            touReachWarn.appendChild(wDetail);
            touReachWarn.appendChild(wHint);
            touReachWarn.appendChild(wDismiss);
          });

          // --- 3. LIVE STATUS DASHBOARD ---
          var statsBox = document.createElement('div');
          statsBox.style.cssText = 'margin-top: 10px; padding-top: 8px; border-top: 1px solid #ceead6; font-size: 11px; color: #555; display: ' + (hasStoredTouAcceptance(map.touId) ? 'block' : 'none') + ';';
          touBox.appendChild(statsBox); // <--- ADD THIS MISSING LINE!

            // Listen for background updates to refresh the UI automatically
          window.addEventListener('openmaps-tou-updated', (e) => {
            if (e.detail.touId === map.touId) updateStatsUI();
          });

          function updateStatsUI() {
             var s = Settings.get();
             var accData = s.state.acceptedToUs[map.touId];
             if (!accData) return;

             // Handle legacy timestamp format gracefully for display
             var isLegacy = (typeof accData === 'number');
             var acceptedDate = new Date(isLegacy ? accData : accData.acceptedAt).toLocaleDateString();
             var lastCheckedStr = (isLegacy || !accData.lastChecked) ? I18n.t('openmaps.tou_stats_pending') : new Date(accData.lastChecked).toLocaleString();
             var nextCheckStr = (isLegacy || !accData.lastChecked) ? I18n.t('openmaps.tou_stats_on_next_reload') : new Date(accData.lastChecked + 30*24*60*60*1000).toLocaleDateString();
             var lenStr = (isLegacy || !accData.length) ? I18n.t('openmaps.tou_stats_pending') : I18n.t('openmaps.tou_stats_chars').replace(/\{n\}/g, accData.length.toLocaleString());

             statsBox.innerHTML = `
               <div style="display:flex; justify-content:space-between; margin-bottom:3px;"><span>${I18n.t('openmaps.tou_stats_accepted')}</span> <strong>${acceptedDate}</strong></div>
               <div style="display:flex; justify-content:space-between; margin-bottom:3px;"><span>${I18n.t('openmaps.tou_stats_baseline_length')}</span> <strong>${lenStr}</strong></div>
               <div style="display:flex; justify-content:space-between; margin-bottom:3px;"><span>${I18n.t('openmaps.tou_stats_last_checked')}</span> <strong>${lastCheckedStr}</strong></div>
               <div style="display:flex; justify-content:space-between; margin-bottom:3px;"><span>${I18n.t('openmaps.tou_stats_next_check')}</span> <strong>${nextCheckStr}</strong></div>
             `;

             var forceBtn = document.createElement('wz-button');
             forceBtn.className = 'openmaps-wz-btn-compact';
             forceBtn.setAttribute('size', 'sm');
             forceBtn.setAttribute('color', 'secondary');
             forceBtn.innerHTML = '<i class="fa fa-refresh" aria-hidden="true"></i> ' + I18n.t('openmaps.tou_force_check');
             forceBtn.style.cssText = 'margin-top: 6px; width: 100%;';

             forceBtn.addEventListener('click', function() {
                forceBtn.innerHTML = '<i class="fa fa-spinner fa-spin" aria-hidden="true"></i> ' + I18n.t('openmaps.tou_checking_url');
                forceBtn.disabled = true;

                performToUCheck(map.touId, true, function(res) {
                   forceBtn.disabled = false;
                   if (res.status === 'unreachable') {
                     forceBtn.innerHTML = '<i class="fa fa-exclamation-triangle" style="color:#f9a825;" aria-hidden="true"></i> ' + formatTouUnreachableDetail(res);
                   } else if (res.status === 'error') {
                     forceBtn.innerHTML = '<i class="fa fa-exclamation-triangle" style="color:#d93025;" aria-hidden="true"></i> ' + res.msg;
                   } else if (res.status === 'revoked') {
                     alert(I18n.t('openmaps.tou_revoked').replace(/\{percent\}/g, (res.diff*100).toFixed(1)));
                     if (UI.touDetails) UI.touDetails.open = false;
                     UI.editContainer.style.display = 'none';
                     updateLinkText();
                   } else if (res.status === 'baseline') {
                     forceBtn.innerHTML = '<i class="fa fa-check" aria-hidden="true"></i> ' + I18n.t('openmaps.tou_baseline_saved');
                     setTimeout(updateStatsUI, 1500);
                   } else if (res.status === 'unchanged') {
                     forceBtn.innerHTML = '<i class="fa fa-check" aria-hidden="true"></i> ' + I18n.t('openmaps.tou_unchanged').replace(/\{variance\}/g, (res.diff*100).toFixed(2) + '%');
                     setTimeout(updateStatsUI, 2500);
                   }
                });
             });
             statsBox.appendChild(forceBtn);
          }
// --- REAL-TIME UI SYNC LISTENER ---
          window.addEventListener('om-tou-sync', (e) => {
            if (e.detail.touId === map.touId) {
              if (e.detail.accepted) {
                acceptBtn.style.display = 'none';
                if (e.detail.sessionUnreachableDismiss) {
                  statsBox.style.display = 'none';
                  refreshTouPanelChrome();
                } else {
                  statsBox.style.display = 'block';
                  refreshTouPanelChrome();
                  setTimeout(() => {
                    updateStatsUI();
                  }, 800);
                }

                if (self.updateVisibility) self.updateVisibility();
                applyActiveMapsFilter();
              } else {
                // If terms are revoked by another map's check, reload to enforce the lock!
                location.reload();
              }
            }
          });

          if (hasStoredTouAcceptance(map.touId)) {
            updateStatsUI();
          }
          // --------------------------------

acceptBtn.addEventListener('click', () => {
            if (!linksClicked || touProbeUnreachable) return;

            var s = Settings.get();
            s.state.acceptedToUs[map.touId] = { acceptedAt: Date.now(), lastChecked: 0, length: 0 };
            Settings.put(s);

            // 1. Broadcast to unlock all other maps with this ToU ID
            window.dispatchEvent(new CustomEvent('om-tou-sync', { detail: { touId: map.touId, accepted: true } }));

            // 2. Start the background check
            performToUCheck(map.touId, true, function() {
                updateStatsUI();
            });

            // 3. Unlock the current map
            self.setManualVisibility(true);

            setTimeout(() => { if (UI.touDetails) UI.touDetails.open = false; }, 1500);
          });

          touBox.appendChild(acceptBtn);
        }

        touDetails.appendChild(touBox);
        touDetails.open = !touUnlocked;
        UI.editContainer.appendChild(touDetails);
      }
      // -----------------------------------------------------------

      var rmBox = document.createElement('div'); rmBox.className = 'open-maps-remove-container';
      var rmLeft = document.createElement('div');
      rmLeft.className = 'open-maps-remove-container-left';

      if (map.type === 'WMS' || map.type === 'ESRI') {
        var capBtn = createIconButton('fa-server', I18n.t('openmaps.server_capabilities_tooltip'), true);
        capBtn.addEventListener('click', function(e) {
          e.preventDefault(); e.stopPropagation();
          openServerCapabilitiesViewer({ forceRefresh: false });
        });
        rmLeft.appendChild(capBtn);
      }

      // --- Copy map definition (pasteable map entry) ---
      var mapCopyMenuRoot = document.createElement('div');
      mapCopyMenuRoot.className = 'open-maps-map-copy-menu-root';
      mapCopyMenuRoot.style.cssText = 'position:relative; display:inline-block;';

      var mapCopyBtn = createIconButton('fa-copy', I18n.t('openmaps.copy_map_definition_tooltip'), true);
      var mapCopyPanel = document.createElement('div');
      mapCopyPanel.className = 'open-maps-map-copy-menu-panel';
      mapCopyPanel.setAttribute('role', 'menu');
      mapCopyPanel.style.display = 'none';

      function createMapCopyMenuItem(textKey, mode) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'open-maps-map-copy-menu-item';
        btn.setAttribute('role', 'menuitem');
        btn.textContent = I18n.t(textKey);
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          var snippet = buildMapDefinitionSnippet(mode);
          omCopyTextToClipboard(snippet).then(function() {
            closeMapCopyMenu();
            var prev = btn.textContent;
            btn.textContent = I18n.t('openmaps.copy_done');
            setTimeout(function() { btn.textContent = prev; }, 1600);
          });
        });
        return btn;
      }

      var mapCopyMenuOpen = false;
      function positionMapCopyMenu() {
        var rect = mapCopyBtn.getBoundingClientRect();
        var pw = mapCopyPanel.offsetWidth || 260;
        var sidebar = document.querySelector('#sidebar') || document.querySelector('#sidepanel') || document.body;
        var srect = sidebar && sidebar.getBoundingClientRect ? sidebar.getBoundingClientRect() : null;
        var minLeft = 8, maxLeft = (window.innerWidth - pw - 8);
        if (srect) {
          minLeft = Math.max(8, srect.left + 8);
          maxLeft = Math.min(window.innerWidth - pw - 8, srect.right - pw - 8);
        }
        var left = rect.right - pw;
        if (left < minLeft) left = minLeft;
        if (left > maxLeft) left = maxLeft;
        mapCopyPanel.style.left = left + 'px';
        mapCopyPanel.style.top = (rect.bottom + 2) + 'px';
      }
      function closeMapCopyMenu() {
        if (!mapCopyMenuOpen) return;
        mapCopyMenuOpen = false;
        mapCopyPanel.style.display = 'none';
        document.removeEventListener('click', onDocCloseMapCopyMenu);
        document.removeEventListener('keydown', onKeyMapCopyMenu);
        window.removeEventListener('resize', closeMapCopyMenu);
      }
      function onDocCloseMapCopyMenu(ev) {
        if (mapCopyMenuRoot.contains(ev.target)) return;
        closeMapCopyMenu();
      }
      function onKeyMapCopyMenu(ev) {
        if (ev.key === 'Escape') closeMapCopyMenu();
      }
      function openMapCopyMenu() {
        mapCopyMenuOpen = true;
        mapCopyPanel.style.display = 'block';
        requestAnimationFrame(function() {
          positionMapCopyMenu();
          requestAnimationFrame(positionMapCopyMenu);
        });
        setTimeout(function() {
          document.addEventListener('click', onDocCloseMapCopyMenu);
          document.addEventListener('keydown', onKeyMapCopyMenu);
          window.addEventListener('resize', closeMapCopyMenu);
        }, 0);
      }

      mapCopyBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (mapCopyMenuOpen) closeMapCopyMenu();
        else openMapCopyMenu();
      });

      mapCopyPanel.appendChild(createMapCopyMenuItem('openmaps.copy_map_definition_menu_all_keep_defaults', 'allKeepDefaults'));
      mapCopyPanel.appendChild(createMapCopyMenuItem('openmaps.copy_map_definition_menu_all_make_enabled_default', 'allMakeEnabledDefault'));
      mapCopyPanel.appendChild(createMapCopyMenuItem('openmaps.copy_map_definition_menu_enabled_only_make_default', 'enabledOnlyMakeDefault'));
      mapCopyMenuRoot.appendChild(mapCopyBtn);
      mapCopyMenuRoot.appendChild(mapCopyPanel);
      rmLeft.appendChild(mapCopyMenuRoot);
      // -----------------------------------------------

      var rmBtn = document.createElement('wz-button');
      rmBtn.setAttribute('size', 'sm');
      rmBtn.setAttribute('color', 'secondary');
      rmBtn.className = 'open-maps-remove-map-wz openmaps-wz-btn-compact openmaps-wz-btn-icon-only';
      rmBtn.innerHTML = '<i class="fa fa-trash" aria-hidden="true"></i>';
      rmBtn.setAttribute('aria-label', I18n.t('openmaps.remove_layer'));
      Tooltips.add(rmBtn, I18n.t('openmaps.remove_layer'));
      rmBtn.addEventListener('click', () => {
        var hi = handles.indexOf(self);
        if (hi !== -1) handles.splice(hi, 1);
        if (map.source === 'user') openMapsRemoveUserMapDefinition(map.id);
        if (layerToggler.parentNode) layerToggler.parentNode.removeChild(layerToggler);
        var card = UI.container;
        if (card.parentNode) card.parentNode.removeChild(card);
        Tooltips.teardownSubtree(card);
        if (self.layer) W.map.removeLayer(self.layer);
        if (self.bboxLayer) W.map.removeLayer(self.bboxLayer);
        requestAnimationFrame(function() {
          saveMapState();
          updateMapSelector();
          refreshMapDrag();
          if (openMapsInspectorApi) openMapsInspectorApi.notifyHandlesChanged();
        });
      });
      rmBox.appendChild(rmLeft);
      rmBox.appendChild(rmBtn);
      UI.editContainer.appendChild(rmBox);

      UI.container.appendChild(UI.editContainer);
    }

    // --- 4. ENGINE CORE ---
// --- UNIFIED VISIBILITY CONTROLLER ---
    this.setManualVisibility = function(wantsVisible) {
      // BLOCK ENABLE IF TOU NOT ACCEPTED OR CONFIG BROKEN
      if (wantsVisible && !isTouAccepted(map.touId)) {
        UI.editContainer.style.display = 'block';
        if (UI.touDetails) UI.touDetails.open = true;
        return;
      }

      self.hidden = !wantsVisible;
      // Enforce Bounding Box
      if (self.layer) {
        self.layer.setVisibility(!self.hidden && !self.outOfArea);
      }

// Sync the Waze native layers menu checkbox
      var checkbox = layerToggler.querySelector('wz-checkbox');
      if (checkbox) {
        checkbox.checked = wantsVisible;
        // FIX: Sync the physical HTML attribute so it survives being dragged and dropped!
        if (wantsVisible) checkbox.setAttribute('checked', '');
        else checkbox.removeAttribute('checked');
      }

      saveMapState();
      if (self.updateVisibility) self.updateVisibility();
      applyActiveMapsFilter();
    };
    // -------------------------------------

this.applyFilters = function() {
      if (!self.layer || !self.layer.div) return;
      // Tile-oriented filters (brightness, mix-blend) break OpenLayers vector renderers (Canvas/SVG) in WME.
      if (map.type === 'ESRI_FEATURE' || map.type === 'GOOGLE_MY_MAPS') return;

      // Calculate Gamma simulation:
      // We use the gamma value to adjust brightness and contrast in tandem
      var gammaFactor = self.gamma / 100;
      var calcBrightness = self.brightness * (1 / gammaFactor);
      var calcContrast = self.contrast * gammaFactor;

      var filterString = `brightness(${calcBrightness}%) ` +
                         `contrast(${calcContrast}%) ` +
                         `saturate(${self.saturate}%) ` +
                         `hue-rotate(${self.hue}deg) ` +
                         (self.invert ? 'invert(100%)' : '');

      self.layer.div.style.filter = filterString;
      self.layer.div.style.webkitFilter = filterString;
    self.layer.div.style.mixBlendMode = self.blendMode;
    };

this.updateBboxLayer = function() {
      if (map.area === 'UN') {
        if (self.bboxLayer) {
          try { self.bboxLayer.setVisibility(false); } catch (eB0) {}
        }
        return;
      }
      if (self.displayBbox) {
        if (!self.bboxLayer) {
          self.bboxLayer = new OpenLayers.Layer.Vector("BBOX_" + map.id, {
            styleMap: new OpenLayers.StyleMap({
              "default": new OpenLayers.Style({ strokeColor: self.bgColor, strokeWidth: 2, strokeDashstyle: 'dash', fillOpacity: 0 })
            }),
            displayInLayerSwitcher: false
          });
          self.bboxLayer.openMapsBboxMapId = map.id;
          var feature = new OpenLayers.Feature.Vector(self.area.toGeometry());
          self.bboxLayer.addFeatures([feature]);
          W.map.addLayer(self.bboxLayer);
        }
        self.bboxLayer.setVisibility(true);
        syncOpenMapsLayerIndices();
      } else {
        if (self.bboxLayer) self.bboxLayer.setVisibility(false);
      }
    };

this.updateVisibility = function() {
      // --- START OF FIX 4B ---
      if (self.layer && self.layer.getVisibility()) {
          // Re-apply filters whenever layer becomes visible to ensure CSS is attached to the div
          // We use a tiny 100ms delay to make sure OpenLayers has finished creating the div
          setTimeout(() => self.applyFilters(), 100);
      }
      // --- END OF FIX 4B ---

      // The map is only physically rendering if it is enabled AND in bounds!
      var isActuallyVisible = self.layer && self.layer.getVisibility();

    // Toggle the modern blue "Active" UX state on the card container
      UI.container.classList.toggle('is-active-map', !!isActuallyVisible);

      // 1. Text gray-out based on ACTUAL visibility
      UI.title.style.color = (isActuallyVisible ? '' : '#999');
  

  
      var inactiveFilter = 'grayscale(85%) opacity(70%)';

      if (UI.badge) {
        // Always keep the original color, just apply the muted filter!
        UI.badge.style.backgroundColor = UI.badge.dataset.activeColor;
        UI.badge.style.filter = isActuallyVisible ? 'none' : inactiveFilter;
      }

  
      // 2. Info icon logic (Zoom bounds)
      var zoom = W.map.getZoom();
      UI.info.style.display = (isActuallyVisible && map.zoomRange && (zoom < map.zoomRange[0] || zoom > map.zoomRange[1]) ? 'inline' : 'none');

      if (UI.zoomMetaLine) {
        var wmsFloorRawZm = map.wmsMinEffectiveZoom != null ? map.wmsMinEffectiveZoom : map.minEffectiveZoom;
        var hasFloorZm = map.type === 'WMS' && wmsFloorRawZm != null && wmsFloorRawZm !== '';
        var floorValZm = null;
        if (hasFloorZm) {
          var fz = Math.floor(Number(wmsFloorRawZm));
          if (!isNaN(fz) && fz > 0) floorValZm = fz;
        }
        var zmParts = [];
        if (map.zoomRange && map.zoomRange.length >= 2) {
          zmParts.push(I18n.t('openmaps.zoom_meta_band') + ': ' + map.zoomRange[0] + '–' + map.zoomRange[1]);
        }
        if (floorValZm != null) {
          zmParts.push(I18n.t('openmaps.zoom_meta_floor') + ': ' + floorValZm);
        }
        zmParts.push(I18n.t('openmaps.zoom_meta_view') + ': ' + zoom);
        UI.zoomMetaLine.textContent = zmParts.join(' · ');
      }

// 3. Eye Icon (Manual State & ToU Lock)
      UI.visibility.classList.remove('fa-eye', 'fa-eye-slash', 'fa-lock');
      if (!isTouAccepted(map.touId)) {
        UI.visibility.classList.add('fa-lock');
        UI.visibility.style.color = '#d93025';
      } else {
        UI.visibility.classList.add(self.hidden ? 'fa-eye-slash' : 'fa-eye');
        UI.visibility.style.color = '';
      }

      if (UI.touPendingBtn) {
        var showTouPending = map.touId !== 'none' && TOU_REGISTRY[map.touId] && !isTouAccepted(map.touId);
        UI.touPendingBtn.style.display = showTouPending ? 'flex' : 'none';
      }

      var visibleLayerCount = self.mapLayers.filter(function(l) { return l.visible; }).length;
      var showNoLayers = !self.hidden && !self.outOfArea && isTouAccepted(map.touId) && self.mapLayers.length > 0 && visibleLayerCount === 0 && ['WMS', 'ESRI', 'XYZ'].indexOf(map.type) !== -1;
      if (UI.noLayersWarningBtn) {
        UI.noLayersWarningBtn.style.display = showNoLayers ? 'flex' : 'none';
      }
      if (UI.mapLayersNoActiveMark) {
        UI.mapLayersNoActiveMark.style.display = showNoLayers ? 'inline' : 'none';
      }

// 4. Bounding Box (Blocked State & UI Toggles)
      UI.visibility.style.color = (self.outOfArea ? '#999' : '');
      UI.visibility.style.cursor = 'pointer';

      if (self.outOfArea) {
        Tooltips.add(UI.visibility, 'Viewport out of Boundary Bbox: ' + map.bbox.join(', '), true);
        if (UI.zoomToBboxBtn) UI.zoomToBboxBtn.style.display = ''; // Show zoom button
      } else {
        Tooltips.add(UI.visibility, I18n.t('openmaps.hideshow_layer'), true);
        if (UI.zoomToBboxBtn) UI.zoomToBboxBtn.style.display = 'none'; // Hide zoom button
      }

      // Hide the Query (Hand) button if the map is manually hidden, locked, or out of bounds!
      if (UI.queryBtn) {
        UI.queryBtn.style.display = (isActuallyVisible && !self.outOfArea) ? '' : 'none';
      }

      // 5. Sync Sub-Layer State!
      if (self.layerUI) {
        self.layerUI.forEach(lUI => {
          var layerIsOn = isActuallyVisible && lUI.item.visible;
          lUI.title.style.color = layerIsOn ? '' : '#999';
          if (lUI.desc) lUI.desc.style.color = layerIsOn ? '' : '#999';

          lUI.badge.style.backgroundColor = lUI.activeColor;
          lUI.badge.style.filter = layerIsOn ? 'none' : inactiveFilter;

          // Hide sub-layer query button if out of bounds!
          if (lUI.queryBtn) {
            lUI.queryBtn.style.display = self.outOfArea ? 'none' : '';
          }
        });
      }
    };

    this.updateLayers = function() {
      var visibleLayers = self.mapLayers.filter(l => l.visible).map(l => l.name);
      if (visibleLayers.length == 0 && self.layer && ['WMS', 'XYZ', 'ESRI', 'ESRI_FEATURE', 'GOOGLE_MY_MAPS'].includes(map.type)) {
        self.layer.setVisibility(false);
      } else if (visibleLayers.length > 0 && !self.layer) {

        var options = {
          transitionEffect: 'resize',
          attribution: map.attribution,
          isBaseLayer: false,
          numZoomLevels: 25,
          maxZoomLevel: 24,
          projection: new OpenLayers.Projection(map.crs),
          tileSize: (map.tile_size ? new OpenLayers.Size(map.tile_size, map.tile_size) : new OpenLayers.Size(512, 512))
        };

        // Canvas pixel reads require CORS-enabled tiles. Enable when pixel manipulations may be applied:
        // - catalog has defaults, OR
        // - user enabled Apply pixel manipulations, OR
        // - user set an override (even if empty)
        var wantsPixelManipulation = !!map.pixelManipulations || !!self.improveMap || (self.pixelManipulationsOverride !== null);
        if (wantsPixelManipulation) options.tileOptions = { crossOriginKeyword: 'anonymous' };
        self.__openmapsTileCrossOrigin = !!(options.tileOptions && options.tileOptions.crossOriginKeyword);

        var openmapsWmsFloorRes = null;

        // NATIVE TILE STRETCHING MATH
        if (map.zoomRange && map.zoomRange[1]) {
            var olMap = typeof W.map.getOLMap === 'function' ? W.map.getOLMap() : null;
            var wazeResolutions = olMap && (olMap.resolutions || (olMap.baseLayer && olMap.baseLayer.resolutions));
            if (wazeResolutions && wazeResolutions.length > 0) {
                options.serverResolutions = wazeResolutions.slice(0, map.zoomRange[1] + 1);
            } else {
                var standardResolutions = [];
                var maxRes = 156543.03392804097;
                for (var i = 0; i <= 24; i++) standardResolutions.push(maxRes / Math.pow(2, i));
                options.serverResolutions = standardResolutions.slice(0, map.zoomRange[1] + 1);
            }
        }

        // WMS + catalog wmsMinEffectiveZoom / minEffectiveZoom:
        // Do not duplicate serverResolutions (that can misalign snaps vs basemap or explode tile counts).
        // Use the normal tile grid: each tile is ~tileSize px, so GetMap WIDTH/HEIGHT stay modest even
        // after upscaling for the floor — large single-tile viewports hit MaxClientSize on many servers.
        // getURL below bumps WIDTH/HEIGHT by mapRes/floorRes when zoomed out past the floor.
        var wmsFloorRaw = map.wmsMinEffectiveZoom != null ? map.wmsMinEffectiveZoom : map.minEffectiveZoom;
        if (map.type === 'WMS' && options.serverResolutions && options.serverResolutions.length > 0 &&
            wmsFloorRaw != null && wmsFloorRaw !== '') {
            var wmsFloor = Math.floor(Number(wmsFloorRaw));
            if (!isNaN(wmsFloor) && wmsFloor > 0) {
                var serverRes = options.serverResolutions;
                var wmsMaxIdx = serverRes.length - 1;
                wmsFloor = Math.min(wmsFloor, wmsMaxIdx);
                openmapsWmsFloorRes = serverRes[wmsFloor];
            }
        }

        // MAP TYPE ROUTER
        switch(map.type) {
            case 'ESRI':
                options.sphericalMercator = true;
                options.getURL = function(bounds) {
                    var exportFormat = (map.format === 'image/jpeg') ? 'jpg' : 'png32';
                    var exportTransparent = (map.format === 'image/jpeg') ? 'false' : self.transparent;
                    var visIds = self.mapLayers.filter(function(l) { return l.visible; }).map(function(l) { return l.name; });
                    // ArcGIS REST export expects integer layer ids in layers=show:0,1,2 (omit non-numeric synthetic keys).
                    var esriIds = [];
                    for (var vi = 0; vi < visIds.length; vi++) {
                      var sid = String(visIds[vi]).trim();
                      if (/^-?\d+$/.test(sid)) esriIds.push(sid);
                    }
                    var layersParam = '';
                    if (esriIds.length > 0) {
                      layersParam = '&layers=show:' + esriIds.join(',');
                    }
                    return map.url + '/export?bbox=' + bounds.left + ',' + bounds.bottom + ',' + bounds.right + ',' + bounds.top +
                           '&bboxSR=3857&imageSR=3857&size=' + this.tileSize.w + ',' + this.tileSize.h +
                           '&format=' + exportFormat + '&transparent=' + exportTransparent + '&f=image' + layersParam;
                };
                self.layer = new OpenLayers.Layer.XYZ(map.title, map.url, options);
                break;

            case 'ESRI_FEATURE':
                // ArcGIS FeatureServer layer rendered as vector overlay.
                // Uses bounded bbox queries with caching to avoid request spam when panning.
                (function initEsriFeatureVector() {
                  var proj3857 = new OpenLayers.Projection('EPSG:3857');
                  var minZoom = (map.minVectorZoom != null && map.minVectorZoom !== '') ? Number(map.minVectorZoom) : null;
                  if (isNaN(minZoom)) minZoom = null;
                  var maxFeatures = (map.maxFeatures != null && map.maxFeatures !== '') ? Number(map.maxFeatures) : 400;
                  if (isNaN(maxFeatures) || maxFeatures <= 0) maxFeatures = 400;

                  var esriPack = openMapsEsriFeatureAvatarMarkerPack(self.bgColor || openMapsMapAvatarColorFromTitle(map.title));
                  var stylePoly = new OpenLayers.Style({
                    fillColor: esriPack.fillHex,
                    fillOpacity: 0.88,
                    strokeColor: '#ffffff',
                    strokeOpacity: 1,
                    strokeWidth: esriPack.polyStrokeW,
                    pointRadius: Math.round(esriPack.symbolR)
                  });
                  var styleSel = new OpenLayers.Style({
                    fillColor: esriPack.fillHex,
                    fillOpacity: 0.42,
                    strokeColor: '#ffffff',
                    strokeOpacity: 0.8,
                    strokeWidth: Math.max(3, Math.round(esriPack.polyStrokeW * 2)),
                    pointRadius: esriPack.highlightR
                  });
                  // Layer projection = ArcGIS outSR (3857). OpenLayers projects into the map CRS on draw (same pattern as WFS).
                  // Match minimal Vector options used by the bbox overlay — custom renderers / flags caused invisible layers in some WME builds.
                  self.layer = new OpenLayers.Layer.Vector(openMapsEsriFeatureVectorOlName(map.id), {
                    projection: proj3857,
                    displayInLayerSwitcher: false,
                    styleMap: new OpenLayers.StyleMap({ 'default': stylePoly, 'select': styleSel }),
                    attribution: map.attribution,
                    isBaseLayer: false
                  });
                  self.layer.openMapsMapId = map.id;
                  self.layer.openMapsEsriAvatarFill = esriPack.fillHex;

                  // Simple in-memory cache: key → { t, featuresJson }
                  var cache = self.__openmapsEsriFeatureCache || new Map();
                  self.__openmapsEsriFeatureCache = cache;
                  var cacheTtlMs = 30 * 1000;
                  var debounceTimer = null;

                  function extentKey(extent, zoom) {
                    // 1km quantization for stable keys
                    function q(v) { return Math.round(Number(v) / 1000); }
                    return String(zoom) + ':' + [q(extent.left), q(extent.bottom), q(extent.right), q(extent.top)].join(',');
                  }

                  function parseFeaturesToOl(json) {
                    var feats = [];
                    if (!json || json.error) return feats;
                    if (!Array.isArray(json.features)) return feats;
                    for (var i = 0; i < json.features.length; i++) {
                      var f = json.features[i];
                      if (!f) continue;
                      var geom = null;
                      try { geom = openMapsEsriGeometryToOpenLayers(f.geometry); } catch (e0) { geom = null; }
                      if (!geom) continue;
                      var attrs = (f.attributes && typeof f.attributes === 'object') ? f.attributes : {};
                      var olf = new OpenLayers.Feature.Vector(geom, attrs);
                      if (attrs.ObjectId != null) olf.fid = String(attrs.ObjectId);
                      else if (attrs.OBJECTID != null) olf.fid = String(attrs.OBJECTID);
                      var gcn = geom.CLASS_NAME;
                      if (gcn === 'OpenLayers.Geometry.Point' || gcn === 'OpenLayers.Geometry.MultiPoint') {
                        olf.style = openMapsEsriPointVectorStyle(esriPack);
                      } else if (gcn === 'OpenLayers.Geometry.LineString' || gcn === 'OpenLayers.Geometry.MultiLineString' || gcn === 'OpenLayers.Geometry.LinearRing') {
                        olf.style = {
                          strokeColor: esriPack.fillHex,
                          strokeWidth: Math.max(2, Math.round(esriPack.polyStrokeW * 1.6)),
                          strokeOpacity: 1,
                          fillOpacity: 0
                        };
                      }
                      feats.push(olf);
                    }
                    return feats;
                  }

                  function bindMapPanZoomOnce() {
                    if (self.__openmapsEsriFeatureMapHandlers) return;
                    var om = (W && W.map && typeof W.map.getOLMap === 'function') ? W.map.getOLMap() : null;
                    if (!om || !om.events) return;
                    self.__openmapsEsriFeatureMapHandlers = true;
                    om.events.register('moveend', self, scheduleRefresh);
                    om.events.register('zoomend', self, scheduleRefresh);
                  }

                  function refreshNow() {
                    bindMapPanZoomOnce();
                    var olMapLive = (W && W.map && typeof W.map.getOLMap === 'function') ? W.map.getOLMap() : null;
                    if (!olMapLive || typeof getMapExtent !== 'function') return;
                    if (!self.layer) return;
                    // Do not rely only on layer.getVisibility(): it is often false until after W.map.addLayer + setVisibility in the same updateLayers pass.
                    if (self.hidden || self.outOfArea || !isTouAccepted(map.touId)) return;
                    if (!self.layer.getVisibility()) return;
                    var z = (typeof olMapLive.getZoom === 'function') ? olMapLive.getZoom() : null;
                    if (minZoom != null && z != null && z < minZoom) {
                      self.layer.removeAllFeatures();
                      return;
                    }
                    var extent = getMapExtent();
                    if (!extent) return;
                    var key = extentKey(extent, z);
                    var now = Date.now();
                    var cached = cache.get(key);
                    if (cached && (now - cached.t) < cacheTtlMs) {
                      self.layer.removeAllFeatures();
                      self.layer.addFeatures(parseFeaturesToOl(cached.json));
                      if (typeof self.layer.redraw === 'function') self.layer.redraw(true);
                      try {
                        if (openMapsInspectorApi && typeof openMapsInspectorApi.notifyEsriFeatureLayerRefreshed === 'function') {
                          openMapsInspectorApi.notifyEsriFeatureLayerRefreshed();
                        }
                      } catch (eInv) { /* ignore */ }
                      try {
                        requestAnimationFrame(function() {
                          requestAnimationFrame(function() {
                            try { pinOpenMapsOverlayStackTop(olMapLive); } catch (ePin) { /* ignore */ }
                          });
                        });
                      } catch (ePin2) { /* ignore */ }
                      return;
                    }

                    var mapProj = olMapLive.getProjectionObject();
                    var qExtent = extent.clone();
                    if (mapProj) {
                      try {
                        qExtent.transform(mapProj, proj3857);
                      } catch (eB) {
                        // WME sometimes reports a projection object that does not transform cleanly; extent is usually already Web Mercator.
                        qExtent = extent.clone();
                      }
                    }
                    var bboxStr = qExtent.left + ',' + qExtent.bottom + ',' + qExtent.right + ',' + qExtent.top;
                    var base = String(map.url || '').replace(/\/+$/, '');
                    var qUrl = base + '/query?f=json&where=' + encodeURIComponent('1=1') +
                      '&returnGeometry=true&outFields=*' +
                      '&geometry=' + encodeURIComponent(bboxStr) +
                      '&geometryType=esriGeometryEnvelope&inSR=3857&outSR=3857&spatialRel=esriSpatialRelIntersects' +
                      '&resultRecordCount=' + encodeURIComponent(String(maxFeatures));

                    function applyFeatureQueryResponse(json, responseGen) {
                      if (responseGen !== self.__openmapsEsriFeatureFetchGen) return;
                      if (!json) return;
                      cache.set(key, { t: Date.now(), json: json });
                      if (!self.layer || !self.layer.getVisibility()) return;
                      self.layer.removeAllFeatures();
                      self.layer.addFeatures(parseFeaturesToOl(json));
                      if (typeof self.layer.redraw === 'function') self.layer.redraw(true);
                      try {
                        if (openMapsInspectorApi && typeof openMapsInspectorApi.notifyEsriFeatureLayerRefreshed === 'function') {
                          openMapsInspectorApi.notifyEsriFeatureLayerRefreshed();
                        }
                      } catch (eInv2) { /* ignore */ }
                    }

                    // WME CSP blocks page fetch() to many tile/Feature hosts; use GM_xmlhttpRequest (@grant). Tampermonkey
                    // sandbox: fall back to unsafeWindow when the injected bridge exposes GM_* only on the page realm.
                    var gmx = typeof GM_xmlhttpRequest === 'function'
                      ? GM_xmlhttpRequest
                      : (typeof unsafeWindow !== 'undefined' && typeof unsafeWindow.GM_xmlhttpRequest === 'function' ? unsafeWindow.GM_xmlhttpRequest : null);
                    if (!gmx) {
                      if (!self.__openmapsEsriGmMissingWarned) {
                        self.__openmapsEsriGmMissingWarned = true;
                        try {
                          console.warn('[OpenMaps] ESRI_FEATURE: GM_xmlhttpRequest is missing. Use Tampermonkey with @grant GM_xmlhttpRequest; bundled “bridge” scripts must not strip that grant.');
                        } catch (eW) {}
                        if (typeof UI !== 'undefined' && UI.error) {
                          UI.error.style.display = 'inline';
                          Tooltips.add(UI.error, 'UNESCO points layer needs GM_xmlhttpRequest (check Tampermonkey @grant; bridge builds must include it).', true);
                        }
                      }
                      return;
                    }

                    self.__openmapsEsriFeatureFetchGen = (self.__openmapsEsriFeatureFetchGen || 0) + 1;
                    var responseGen = self.__openmapsEsriFeatureFetchGen;

                    if (!self.__openmapsEsriFirstQueryLogged) {
                      self.__openmapsEsriFirstQueryLogged = true;
                      try { console.info('[OpenMaps] ESRI_FEATURE query (first):', qUrl); } catch (eL) {}
                    }

                    gmx({
                      method: 'GET',
                      headers: { Accept: 'application/json' },
                      url: qUrl,
                      timeout: 15000,
                      onload: function(res) {
                        if (responseGen !== self.__openmapsEsriFeatureFetchGen) return;
                        if (!res || res.status !== 200) {
                          try { console.warn('[OpenMaps] ESRI_FEATURE HTTP', res && res.status); } catch (eH) {}
                          return;
                        }
                        var json = null;
                        try { json = JSON.parse(res.responseText || '{}'); } catch (e1) { json = null; }
                        if (!self.__openmapsEsriFirstResponseLogged) {
                          self.__openmapsEsriFirstResponseLogged = true;
                          try {
                            var nf = json && Array.isArray(json.features) ? json.features.length : 0;
                            console.info('[OpenMaps] ESRI_FEATURE first response feature count:', nf, json && json.error ? json.error : '');
                          } catch (eR) {}
                        }
                        applyFeatureQueryResponse(json, responseGen);
                      },
                      onerror: function() {
                        if (responseGen === self.__openmapsEsriFeatureFetchGen) {
                          try { console.warn('[OpenMaps] ESRI_FEATURE GM_xmlhttpRequest onerror'); } catch (eE) {}
                        }
                      },
                      ontimeout: function() {
                        if (responseGen === self.__openmapsEsriFeatureFetchGen) {
                          try { console.warn('[OpenMaps] ESRI_FEATURE GM_xmlhttpRequest timeout'); } catch (eT) {}
                        }
                      }
                    });
                  }

                  function scheduleRefresh() {
                    bindMapPanZoomOnce();
                    if (debounceTimer) clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(refreshNow, 250);
                  }

                  if (!self.__openmapsEsriFeatureBound) {
                    self.__openmapsEsriFeatureBound = true;
                    self.layer.events.register('visibilitychanged', self, function() {
                      if (self.layer && self.layer.getVisibility()) scheduleRefresh();
                      else if (self.layer) self.layer.removeAllFeatures();
                    });
                  }
                  // Defer first fetch: scheduleRefresh() must run after W.map.addLayer + setVisibility (same updateLayers), or refreshNow exits early and never hits the network.
                  self.__openmapsEsriFeatureScheduleRefresh = scheduleRefresh;
                })();
                break;

            case 'GOOGLE_MY_MAPS':
                (function initGoogleMyMapsKml() {
                  var proj4326 = new OpenLayers.Projection('EPSG:4326');
                  var proj3857 = new OpenLayers.Projection('EPSG:3857');
                  var kmlFormat = (OpenLayers.Format && OpenLayers.Format.KML) ? new OpenLayers.Format.KML({
                    internalProjection: proj3857,
                    externalProjection: proj4326
                  }) : null;
                  var esriPackG = openMapsEsriFeatureAvatarMarkerPack(self.bgColor || openMapsMapAvatarColorFromTitle(map.title));
                  var stylePolyG = new OpenLayers.Style({
                    fillColor: esriPackG.fillHex,
                    fillOpacity: 0.75,
                    strokeColor: '#ffffff',
                    strokeOpacity: 1,
                    strokeWidth: esriPackG.polyStrokeW,
                    pointRadius: Math.max(4, Math.round(esriPackG.symbolR)),
                    graphicName: 'circle'
                  });
                  self.layer = new OpenLayers.Layer.Vector(openMapsGoogleMyMapsLayerOlName(map.id), {
                    projection: proj3857,
                    displayInLayerSwitcher: false,
                    styleMap: new OpenLayers.StyleMap({ 'default': stylePolyG }),
                    attribution: map.attribution,
                    isBaseLayer: false,
                    renderers: ['Canvas', 'SVG']
                  });
                  self.layer.openMapsMapId = map.id;
                  self.__openmapsGmmRemovedFromOlStack = true;

                  var debounceGmm = null;
                  var gmmGen = 0;
                  var maxFeatsGmm = 1500;

                  function showGmmErr(msg) {
                    try {
                      if (window.getComputedStyle(UI.error).display !== 'none') return;
                      UI.error.style.display = 'inline';
                      Tooltips.add(UI.error, openMapsEscapeForHtmlTooltip(msg), true);
                    } catch (eGe) { /* ignore */ }
                  }

                  function fetchKmlNow() {
                    if (!kmlFormat) {
                      showGmmErr(I18n.t('openmaps.user_maps_kml_unsupported'));
                      return;
                    }
                    if (!self.layer || !self.layer.getVisibility() || self.hidden || self.outOfArea) return;
                    if (!isTouAccepted(map.touId)) return;
                    gmmGen++;
                    var myG = gmmGen;
                    var urlG = map.url + (map.url.indexOf('?') > -1 ? '&' : '?') + '_ts=' + Date.now();
                    GM_xmlhttpRequest({
                      method: 'GET',
                      url: urlG,
                      timeout: 25000,
                      onload: function(resG) {
                        if (myG !== gmmGen) return;
                        if (!resG || resG.status !== 200) {
                          showGmmErr(I18n.t('openmaps.user_maps_add_error_network'));
                          return;
                        }
                        var textG = resG.responseText || '';
                        if (textG.indexOf('<kml') === -1 && textG.indexOf('<Kml') === -1) {
                          showGmmErr(I18n.t('openmaps.user_maps_add_error_parse'));
                          return;
                        }
                        var featsG = [];
                        try {
                          featsG = kmlFormat.read(textG) || [];
                        } catch (eKg) {
                          showGmmErr(I18n.t('openmaps.user_maps_add_error_parse'));
                          return;
                        }
                        if (!Array.isArray(featsG)) featsG = [];
                        if (featsG.length > maxFeatsGmm) featsG = featsG.slice(0, maxFeatsGmm);
                        self.layer.removeAllFeatures();
                        self.layer.addFeatures(featsG);
                        self.clearError();
                        try {
                          if (typeof openMapsGmmDiagEnabled === 'function' && openMapsGmmDiagEnabled()) {
                            var olmK = (typeof W !== 'undefined' && W.map && typeof W.map.getOLMap === 'function') ? W.map.getOLMap() : null;
                            openMapsGmmDiagLog('KML addFeatures done', {
                              featureCount: featsG.length,
                              layerName: self.layer && self.layer.name != null ? String(self.layer.name) : null
                            });
                            openMapsGmmDiagOlStackSnapshot(olmK, 'after KML addFeatures');
                          }
                        } catch (eKd) { /* ignore */ }
                      },
                      onerror: function() {
                        if (myG === gmmGen) showGmmErr(I18n.t('openmaps.user_maps_add_error_network'));
                      },
                      ontimeout: function() {
                        if (myG === gmmGen) showGmmErr(I18n.t('openmaps.user_maps_add_error_network'));
                      }
                    });
                  }

                  function scheduleGmm() {
                    // We only redraw if we actually need a feature reload, not just because we moved.
                    // Empty redraws on large vector layers might freeze tile loaders.
                  }

                  self.__openmapsGmmKmlFetchTriggered = false;
                  self.__openmapsGmmTriggerFetch = function() {
                    if (self.__openmapsGmmKmlFetchTriggered) return;
                    self.__openmapsGmmKmlFetchTriggered = true;
                    fetchKmlNow();
                  };

                  function bindGmmMapMoveOnce() {
                    if (self.__openmapsGmmMoveBound) return;
                    self.__openmapsGmmMoveBound = true;
                    // No need to hook moveend for GMM if it causes massive stuttering/dropping
                  }

                  if (!self.__openmapsGmmVisBound) {
                    self.__openmapsGmmVisBound = true;
                    self.layer.events.register('visibilitychanged', self, function() {
                      if (self.layer && !self.layer.getVisibility()) {
                        gmmGen++;
                        self.layer.removeAllFeatures();
                      }
                    });
                  }

                  self.__openmapsGmmScheduleRefresh = function() {
                    bindGmmMapMoveOnce();
                  };
                })();
                break;

            case 'XYZ':
                options.sphericalMercator = true;
                options.getURL = function(bounds) {
                    // Guard against occasional OpenLayers recursion between getURL/getXYZ.
                    // When it happens, WME UI can freeze for seconds (or longer).
                    if (this.__openmapsXYZRecursionGuard) return '';
                    this.__openmapsXYZRecursionGuard = true;
                    try {
                      var z = (this.map && typeof this.map.getZoom === 'function') ? this.map.getZoom() : null;
                      var resolution = null;
                      if (typeof this.getResolution === 'function') resolution = this.getResolution();
                      if (resolution == null && this.map && typeof this.map.getResolution === 'function') resolution = this.map.getResolution();
                      if (z == null || resolution == null) return '';

                      // Prefer the layer grid origin OpenLayers uses for tile math.
                      var origin = this.gridOrigin || (this.map && this.map.baseLayer && this.map.baseLayer.gridOrigin) ||
                        { lon: -20037508.342789244, lat: 20037508.342789244 }; // WebMercator

                      var tileSize = this.tileSize || new OpenLayers.Size(256, 256);
                      var tileW = (tileSize && tileSize.w != null) ? tileSize.w : 256;
                      var tileH = (tileSize && tileSize.h != null) ? tileSize.h : 256;

                      // `bounds` is the tile extent in the layer projection (EPSG:3857 for this repo's XYZ tiles).
                      var x = Math.floor((bounds.left - origin.lon) / (resolution * tileW));
                      var y = Math.floor((origin.lat - bounds.top) / (resolution * tileH));

                      return map.url
                        .replace('${z}', z)
                        .replace('${y}', y)
                        .replace('${x}', x);
                    } finally {
                      this.__openmapsXYZRecursionGuard = false;
                    }
                };
                self.layer = new OpenLayers.Layer.XYZ(map.title, map.url, options);
                break;

            case 'WMS':
            default:
                var params = { layers: visibleLayers.join(), transparent: self.transparent, format: map.format };
                self.layer = new OpenLayers.Layer.WMS(map.title, map.url, params, options);
                if (openmapsWmsFloorRes != null) {
                  var floorRes = openmapsWmsFloorRes;
                  self.layer.getURL = function(bounds) {
                    bounds = this.adjustBounds(bounds);
                    var imageSize = this.getImageSize();
                    var mapRes = this.map.getResolution();
                    var fac = 1;
                    if (mapRes > floorRes) {
                      fac = mapRes / floorRes;
                      // ČÚZK (and many ArcGIS WMS) enforce MaxClientSize; keep this conservative.
                      var maxPx = 2048;
                      if (imageSize.w * fac > maxPx || imageSize.h * fac > maxPx) {
                        fac = Math.min(maxPx / imageSize.w, maxPx / imageSize.h, fac);
                      }
                    }
                    var w = Math.max(1, Math.round(imageSize.w * fac));
                    var h = Math.max(1, Math.round(imageSize.h * fac));
                    var newParams = {};
                    var reverseAxisOrder = this.reverseAxisOrder();
                    newParams.BBOX = this.encodeBBOX ?
                      bounds.toBBOX(null, reverseAxisOrder) :
                      bounds.toArray(reverseAxisOrder);
                    newParams.WIDTH = w;
                    newParams.HEIGHT = h;
                    return this.getFullRequestString(newParams);
                  };
                }
                break;
        }

        if (map.type === 'ESRI_FEATURE' || map.type === 'GOOGLE_MY_MAPS') {
          if (typeof self.layer.setOpacity === 'function') self.layer.setOpacity(1);
        } else {
          self.layer.setOpacity(self.opacity / 100);
        }
        self.layer.setVisibility(!self.hidden && !self.outOfArea);

        if (openMapsMapHasZoomMeta(map)) {
          self.layer.events.register('moveend', null, function(obj) {
            if (obj.zoomChanged) {
              self.updateVisibility();
            }
          });
        }

        // Vector layers (ESRI_FEATURE, GOOGLE_MY_MAPS) are not tile grids; tile events are unreliable and can break error handling.
        if (map.type !== 'ESRI_FEATURE' && map.type !== 'GOOGLE_MY_MAPS') {
          self.layer.events.register('tileerror', null, obj => {
            if (window.getComputedStyle(UI.error).display !== 'none') return;
            UI.error.style.display = 'inline';
            Tooltips.add(UI.error, 'Checking layer status…', true);

            loadTileError(obj.tile, msg => {
              if (msg.ok) {
                self.clearError();
              } else {
                Tooltips.add(UI.error, openMapsEscapeForHtmlTooltip(msg.title) + '\n' + openMapsEscapeForHtmlTooltip(msg.description), true, { html: true });
              }
            });
          });

          self.layer.events.register('tileloadstart', null, () => { totalTiles++; updateTileLoader(); });
          self.layer.events.register('tileloaded', null, evt => {
            loadedTiles++; updateTileLoader();
            var eff = null;
            if (self.improveMap) {
              eff = Array.isArray(self.pixelManipulationsOverride)
                ? self.pixelManipulationsOverride
                : (openMapsNormalizePixelManipulations(map.pixelManipulations) || null);
            }
            if (eff && eff.length) manipulateTile(evt, eff);
          });
        }
        if (map.type === 'GOOGLE_MY_MAPS') {
          if (typeof self.__openmapsGmmRegisterEvents === 'function') {
            self.__openmapsGmmRegisterEvents();
          }
        } else {
          self.layer.events.register('visibilitychanged', null, self.updateVisibility);
        }

        if (map.type === 'ESRI_FEATURE') {
          var olMapAttachV = W.map.getOLMap();
          if (olMapAttachV && olMapAttachV.layers && olMapAttachV.layers.indexOf(self.layer) === -1) {
            olMapAttachV.addLayer(self.layer);
          }
          if (typeof self.__openmapsEsriFeatureScheduleRefresh === 'function') {
            var esriSched = self.__openmapsEsriFeatureScheduleRefresh;
            setTimeout(function() { esriSched(); }, 0);
            setTimeout(function() { esriSched(); }, 350);
          }
        } else if (map.type === 'GOOGLE_MY_MAPS') {
          // Bypassing WME's `W.map.addLayer` wrapper for heavy Vector layers.
          // For GMM, we DELAY adding it to the map until it is actually visible,
          // to prevent WME satellite tiles from breaking due to rapid add/remove on init.
        } else {
          W.map.addLayer(self.layer);
        }

        syncOpenMapsLayerIndices();

      } else if (layerRedrawNeeded) {
        if (self.layer) {
          if (map.type === 'WMS') self.layer.mergeNewParams({ layers: visibleLayers.join() });
          else if (map.type === 'XYZ' || map.type === 'ESRI') self.layer.redraw();
          else if (map.type === 'GOOGLE_MY_MAPS' && typeof self.__openmapsGmmScheduleRefresh === 'function') {
            self.__openmapsGmmScheduleRefresh();
          }
        }
        layerRedrawNeeded = false;
      }
      if (visibleLayers.length > 0 && self.layer && ['WMS', 'XYZ', 'ESRI', 'ESRI_FEATURE', 'GOOGLE_MY_MAPS'].includes(map.type)) {
        self.layer.setVisibility(!self.hidden && !self.outOfArea);
      }
      if (map.type === 'GOOGLE_MY_MAPS' && self.layer) {
        var gmmShow = visibleLayers.length > 0 && !self.hidden && !self.outOfArea && isTouAccepted(map.touId);
        var gmmStackTouched = false;
        if (!gmmShow) {
          var gmmWasOnStack = self.__openmapsGmmRemovedFromOlStack !== true;
          if (gmmWasOnStack) {
            try { self.layer.removeAllFeatures(); } catch (eGf) { /* ignore */ }
            try { openMapsGoogleMyMapsLayerRemoveFromMap(self.layer); } catch (eGr) { /* ignore */ }
            self.__openmapsGmmRemovedFromOlStack = true;
            gmmStackTouched = true;
          }
        } else {
          if (self.__openmapsGmmRemovedFromOlStack) {
            try { openMapsGoogleMyMapsLayerAddToMap(self.layer); } catch (eGa) { /* ignore */ }
            self.__openmapsGmmRemovedFromOlStack = false;
            try { self.layer.setVisibility(true); } catch (eGv) { /* ignore */ }
            if (typeof self.__openmapsGmmTriggerFetch === 'function') self.__openmapsGmmTriggerFetch();
            if (typeof self.__openmapsGmmScheduleRefresh === 'function') self.__openmapsGmmScheduleRefresh();
            gmmStackTouched = true;
          }
        }
        try {
          if (self.layer.div) self.layer.div.style.pointerEvents = 'none';
        } catch (eGpe) { /* ignore */ }
        if (gmmStackTouched) {
          try {
            syncOpenMapsLayerIndices();
          } catch (eGsync) { /* ignore */ }
        }
      }
      saveMapState();
      self.updateVisibility();
    };

// --- 5. INITIAL EXECUTION ---
    buildMainCard();
    buildEditPanel();
    this.updateLayers();
    this.updateBboxLayer();
    this.applyFilters(); // Trigger filters on boot
    this.updateVisibility();
  }

  //#region Add style
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.textContent = `
/* Inject native Waze typography and hardware-accelerated smoothing to fix "rough" text */
#sidepanel-openMaps {
  /* FIX: 4px left padding, 18px right padding for breathing room */
  padding: 0 18px 0 4px;
  box-sizing: border-box;
  overflow-x: hidden;
  /* Let the pane size to content; map picker uses position:fixed (see positionAddMapSuggestions) */
  overflow-y: visible !important;
  max-height: none !important;
  min-height: 0;
  height: fit-content;
  font-family: var(--wz-font-family, "Rubik", "Boing", "Helvetica Neue", Helvetica, Arial, sans-serif);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: var(--wz-body-font-size, 13px);
}

#sidepanel-openMaps .openmaps-active-maps-header,
#sidepanel-openMaps .openmaps-add-maps-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 8px 0; flex-wrap: wrap; }
#sidepanel-openMaps .openmaps-add-maps-header { margin-top: 20px; }
#sidepanel-openMaps .openmaps-active-maps-header h4,
#sidepanel-openMaps .openmaps-add-maps-header h4 { margin: 0; font-size: 1.3em; font-weight: bold; flex: 1 1 auto; min-width: 0; line-height: 1.2; }
#sidepanel-openMaps .openmaps-active-maps-mode-select,
#sidepanel-openMaps .openmaps-add-maps-mode-select { width: auto !important; max-width: min(50%, 240px); min-width: 118px; flex-shrink: 0; height: 32px; font-size: 12px !important; padding: 4px 6px !important; box-sizing: border-box; }
#sidepanel-openMaps .openmaps-active-maps-filter-bar { margin: 0 0 8px 0; }
#sidepanel-openMaps .openmaps-active-maps-filter-empty { font-size: 11px; color: var(--content_secondary, #70757a); margin-top: 6px; line-height: 1.35; }
#sidepanel-openMaps select, #sidepanel-openMaps .openmaps-add-map-filter { background-color: var(--background_variant, #f2f4f7); height: 32px; font-size: 1.1em; width: 100%; border-radius: 4px; border: 1px solid var(--border_subtle, #ccc); padding: 4px 8px; box-sizing: border-box; color: var(--content_primary, #3c4043); outline: none; transition: border-color 0.2s; }
#sidepanel-openMaps .openmaps-add-map-filter:focus { border-color: #267bd8; box-shadow: 0 0 0 1px #267bd8; }
/* position/size set in JS (fixed) so list is not clipped by sidebar overflow and uses space below input */
#sidepanel-openMaps .openmaps-add-map-suggestions { display: none; position: fixed; margin: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; background: var(--background_default, #fff); border: 1px solid var(--border_subtle, #ccc); border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); box-sizing: border-box; }
#sidepanel-openMaps .openmaps-add-map-suggestion-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; cursor: pointer; border-bottom: 1px solid var(--border_subtle, #eee); }
#sidepanel-openMaps .openmaps-add-map-suggestion-row:last-child { border-bottom: none; }
#sidepanel-openMaps .openmaps-add-map-suggestion-row:hover { background-color: var(--background_variant, #f1f3f4); }
#sidepanel-openMaps .openmaps-add-map-suggestion-flag { width: 16px; height: 12px; object-fit: cover; border-radius: 2px; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.08); box-sizing: border-box; vertical-align: middle; }
#sidepanel-openMaps .openmaps-add-map-suggestion-flag-spacer { display: inline-block; width: 16px; height: 12px; flex-shrink: 0; }
#sidepanel-openMaps .openmaps-add-map-suggestion-text { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
#sidepanel-openMaps .openmaps-add-map-suggestion-title { font-weight: 600; font-size: 13px; color: var(--content_primary, #3c4043); line-height: 1.25; }
#sidepanel-openMaps .openmaps-add-map-suggestion-sub { font-size: 11px; color: var(--content_secondary, #70757a); line-height: 1.2; }
#sidepanel-openMaps .openmaps-add-map-suggestion-empty { padding: 10px 8px; color: var(--content_secondary, #70757a); font-size: 12px; line-height: 1.35; }

/* 1. INCREASE SPACE AMONG MAP CARDS */
#sidepanel-openMaps > .openmaps-map-list { display: flex; flex-direction: column; gap: 8px; margin-left: 4px; }

.openmaps-inspector-table-overlay { align-items: center; justify-content: center; }

/* Map Inspector — My Maps–inspired: white panel, soft shadow, thin dividers, flat icon hit targets */
.openmaps-inspector-window {
  font-family: var(--wz-font-family, "Rubik", "Boing", "Helvetica Neue", Helvetica, Arial, sans-serif);
  -webkit-font-smoothing: antialiased;
  color: #202124;
}
.openmaps-inspector-window .openmaps-inspector-window-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 7px 10px 6px;
  background: #fff;
  border-bottom: 1px solid #e8eaed;
  cursor: move;
  user-select: none;
}
.openmaps-inspector-window .openmaps-inspector-window-title {
  font-weight: 500;
  font-size: 12px;
  color: #202124;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0;
  line-height: 1.25;
}
.openmaps-inspector-window .openmaps-inspector-details {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.openmaps-inspector-window .openmaps-inspector-panel {
  padding: 0;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.openmaps-inspector-window .openmaps-inspector-hd,
.openmaps-inspector-window .openmaps-inspector-filter-outer,
.openmaps-inspector-window .openmaps-inspector-status,
.openmaps-inspector-window .openmaps-inspector-query-row {
  flex-shrink: 0;
}
.openmaps-inspector-window .openmaps-inspector-hd {
  font-size: 10px;
  font-weight: 600;
  color: #70757a;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin: 0 0 4px 0;
  line-height: 1.15;
}
.openmaps-inspector-window .openmaps-inspector-sep {
  border-top: 1px solid #e8eaed;
  margin-top: 5px;
  padding-top: 5px;
}
.openmaps-inspector-window .openmaps-inspector-filter-outer {
  margin-top: 5px;
  padding-top: 5px;
  border-top: 1px solid #e8eaed;
}
.openmaps-inspector-window .openmaps-inspector-search-wrap {
  display: flex;
  align-items: center;
  gap: 3px;
  width: 100%;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #dadce0;
  border-radius: 6px;
  padding: 1px 6px 1px 8px;
  min-height: 28px;
}
.openmaps-inspector-window .openmaps-inspector-ibtn {
  border: none;
  background: transparent;
  padding: 0 4px;
  margin: 0;
  cursor: pointer;
  color: #5f6368;
  font-size: 14px;
  line-height: 1;
  border-radius: 50%;
  min-width: 28px;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
  transition: background-color 0.15s ease, color 0.15s ease;
  -webkit-appearance: none;
  appearance: none;
}
.openmaps-inspector-window .openmaps-inspector-ibtn:hover {
  background: #f1f3f4;
  color: #202124;
}
.openmaps-inspector-window .openmaps-inspector-ibtn:active {
  background: #e8eaed;
}
.openmaps-inspector-window .openmaps-inspector-ibtn:focus-visible {
  outline: 2px solid #1a73e8;
  outline-offset: 1px;
}
.openmaps-inspector-window .openmaps-inspector-ibtn--win {
  min-width: 32px;
  min-height: 32px;
}
.openmaps-inspector-window .openmaps-inspector-search-wrap .openmaps-inspector-ibtn {
  min-width: 24px;
  min-height: 24px;
  font-size: 12px;
  color: #1a73e8;
}
.openmaps-inspector-window .openmaps-inspector-search-wrap .openmaps-inspector-ibtn:hover {
  background: #e8f0fe;
  color: #174ea6;
}
.openmaps-inspector-window .openmaps-inspector-filter-min {
  flex: 1;
  min-width: 0;
  height: 24px;
  font-size: 12px;
  padding: 0 2px;
  border: none;
  border-radius: 0;
  background: transparent;
  outline: none;
  box-shadow: none;
  box-sizing: border-box;
  color: #202124;
}
.openmaps-inspector-window .openmaps-inspector-filter-min::placeholder {
  color: #80868b;
}
.openmaps-inspector-window .openmaps-inspector-filter-min:focus {
  outline: none;
}
.openmaps-inspector-window .openmaps-inspector-sources-toolbar {
  margin-bottom: 4px;
}
.openmaps-inspector-window .openmaps-inspector-sources-tree {
  max-height: 160px;
  overflow: auto;
  margin: 0;
  padding: 0 2px 4px 0;
  -webkit-overflow-scrolling: touch;
}
.openmaps-inspector-window .openmaps-inspector-tree-det {
  margin: 0 0 6px 0;
  border: 0;
  padding: 0;
  background: transparent;
}
.openmaps-inspector-window .openmaps-inspector-tree-sum {
  cursor: pointer;
  font-weight: 500;
  font-size: 13px;
  color: #202124;
  padding: 4px 0 4px 2px;
  list-style-position: outside;
  outline: none;
}
.openmaps-inspector-window .openmaps-inspector-tree-sum::-webkit-details-marker {
  color: #5f6368;
}
.openmaps-inspector-window .openmaps-inspector-tree-body {
  padding: 2px 0 4px 10px;
}
.openmaps-inspector-window .openmaps-inspector-tree-subhd {
  margin-top: 6px;
  margin-bottom: 2px;
  font-size: 11px;
  font-weight: 600;
  color: #70757a;
}
.openmaps-inspector-window .openmaps-inspector-tree-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 4px 0;
  cursor: pointer;
  font-size: 12px;
  color: #3c4043;
  line-height: 1.3;
}
.openmaps-inspector-window .openmaps-inspector-tree-row--ind {
  padding-left: 4px;
}
.openmaps-inspector-window .openmaps-inspector-tree-empty {
  color: #70757a;
  font-style: italic;
  font-size: 12px;
  padding: 4px 0;
}
.openmaps-inspector-window .openmaps-inspector-list {
  flex: 1 1 auto;
  min-height: 120px;
  max-height: min(78vh, calc(90vh - 200px));
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  -webkit-overflow-scrolling: touch;
}
.openmaps-inspector-window .openmaps-inspector-map-group {
  min-width: 0;
  max-width: 100%;
  margin: 0 0 4px 0;
}
.openmaps-inspector-window .openmaps-inspector-status {
  font-size: 10px;
  color: #70757a;
  margin: 2px 0 0 0;
  min-height: 12px;
  line-height: 1.2;
}
.openmaps-inspector-window .openmaps-inspector-status--has {
  margin-bottom: 1px;
}
.openmaps-inspector-window .openmaps-inspector-status--busy {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px 4px;
}
.openmaps-inspector-window .openmaps-inspector-status-scan {
  font-size: 10px;
  color: #1a73e8;
  white-space: nowrap;
}
.openmaps-inspector-window .openmaps-inspector-status-scan .fa-spinner {
  margin-right: 2px;
}
.openmaps-inspector-window .openmaps-inspector-map-group:last-child {
  margin-bottom: 0;
}
.openmaps-inspector-window .openmaps-inspector-map-head {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 3px 3px 1px;
  margin: 0 0 1px 0;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  border-bottom: 1px solid #e8eaed;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  color: #202124;
}
.openmaps-inspector-window .openmaps-inspector-map-head-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.openmaps-inspector-window .openmaps-inspector-map-head-count {
  flex-shrink: 0;
  font-weight: 500;
  color: #5f6368;
  font-size: 10px;
}
.openmaps-inspector-window .openmaps-inspector-map-menu-details {
  flex-shrink: 0;
  position: relative;
}
.openmaps-inspector-window .openmaps-inspector-map-menu-summary {
  list-style: none;
}
.openmaps-inspector-window .openmaps-inspector-map-menu-summary::-webkit-details-marker {
  display: none;
}
.openmaps-inspector-window .openmaps-inspector-map-menu-panel {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 5;
  margin-top: 2px;
  background: var(--background_default, #fff);
  border: 1px solid #e8eaed;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  min-width: 148px;
  padding: 4px 0;
}
.openmaps-inspector-window .openmaps-inspector-map-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  color: #202124;
  font-family: inherit;
}
.openmaps-inspector-window .openmaps-inspector-map-menu-item:hover {
  background: #f1f3f4;
}
.openmaps-inspector-window .openmaps-inspector-map-head .openmaps-inspector-ibtn {
  flex-shrink: 0;
  min-width: 22px;
  min-height: 22px;
  font-size: 12px;
}
.openmaps-inspector-window .openmaps-inspector-avatar {
  width: 16px;
  height: 16px;
  min-width: 16px;
  border-radius: 50%;
  flex-shrink: 0;
  display: block;
  box-sizing: border-box;
  box-shadow: 0 1px 2px rgba(0,0,0,0.25);
}
.openmaps-inspector-callout-panel {
  position: absolute;
  left: 0;
  top: 0;
  transform: translate(-50%, calc(-100% - 10px));
  min-width: 200px;
  max-width: min(96vw, 560px);
  background: var(--background_default, #fff);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  border: 1px solid #e8eaed;
  padding: 10px 12px 12px;
  pointer-events: auto;
  box-sizing: border-box;
  -webkit-user-select: text;
  user-select: text;
}
.openmaps-inspector-callout-panel::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -8px;
  margin-left: -8px;
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid var(--background_default, #fff);
  filter: drop-shadow(0 2px 2px rgba(0,0,0,0.08));
}
.openmaps-inspector-callout-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.openmaps-inspector-callout-title {
  font-weight: 600;
  font-size: 14px;
  color: #202124;
  line-height: 1.3;
  min-width: 0;
  word-break: break-word;
}
.openmaps-inspector-callout-close {
  flex-shrink: 0;
  border: none;
  background: transparent;
  padding: 0 4px;
  margin: 0;
  cursor: pointer;
  color: #5f6368;
  font-size: 22px;
  line-height: 1;
  border-radius: 4px;
  -webkit-appearance: none;
  appearance: none;
  -webkit-user-select: none;
  user-select: none;
}
.openmaps-inspector-callout-close:hover {
  background: #f1f3f4;
  color: #202124;
}
.openmaps-inspector-callout-body {
  margin: 0;
  padding: 0;
  font-size: 12px;
  line-height: 1.4;
  color: #3c4043;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  -webkit-user-select: text;
  user-select: text;
  cursor: text;
}
.openmaps-inspector-window .openmaps-inspector-list-row {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 5px;
  padding: 2px 4px;
  margin: 0;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  line-height: 1.15;
  transition: background-color 0.12s ease;
}
.openmaps-inspector-window .openmaps-inspector-row-main {
  min-width: 0;
  flex: 1;
}
.openmaps-inspector-window .openmaps-inspector-row-title {
  font-weight: 400;
  color: #202124;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.15;
}
.openmaps-inspector-window .openmaps-inspector-row-sub {
  font-size: 9px;
  color: #70757a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 0;
  line-height: 1.15;
}
.openmaps-inspector-window .openmaps-inspector-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 10px;
  background: #f1f3f4;
  color: #5f6368;
  text-transform: lowercase;
  line-height: 1.2;
}
.openmaps-inspector-window .openmaps-inspector-list-row--hov:not(.openmaps-inspector-list-row--sel) {
  background: #f5f5f5 !important;
}
.openmaps-inspector-window .openmaps-inspector-list-row--sel {
  background: #e8f0fe !important;
}
.openmaps-inspector-window .openmaps-inspector-list-row--sel.openmaps-inspector-list-row--hov {
  background: #d2e3fc !important;
}
.openmaps-inspector-window .openmaps-inspector-list-row:hover:not(.openmaps-inspector-list-row--sel):not(.openmaps-inspector-list-row--hov) {
  background: #fafafa !important;
}
.openmaps-inspector-window .openmaps-inspector-empty {
  padding: 5px 3px;
  color: #70757a;
  font-size: 11px;
  line-height: 1.3;
}
.openmaps-inspector-window .openmaps-inspector-ingest-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #5f6368;
  cursor: pointer;
  margin: 0;
  line-height: 1.25;
}
#sidepanel-openMaps .openmaps-inspector-launcher-btn {
  border: none;
  background: transparent;
  color: #5f6368;
  cursor: pointer;
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 17px;
  line-height: 1;
  box-shadow: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}
#sidepanel-openMaps .openmaps-inspector-launcher-btn:hover {
  background: #f1f3f4;
  color: #202124;
}

/* 3. MAKE MAP CARDS AS BIG AS LAYER CARDS */
#sidepanel-openMaps .maps-menu-item {
  --wz-card-padding: 6px;
  cursor: default;
  width: 100%;
  margin-bottom: 0px;
  box-sizing: border-box;
  border: 1px solid transparent; /* Prevents layout shifting when active border is applied */
  transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

/* --- NEW: MODERN ACTIVE STATE --- */
#sidepanel-openMaps .maps-menu-item.is-active-map {
  background-color: #f4f8fe; /* Subtle Waze Blue background */
  border: 1px solid #1a73e8; /* Strong Primary Blue border */
  box-shadow: 0 2px 4px rgba(26, 115, 232, 0.15); /* Soft glowing shadow */
}

#sidepanel-openMaps .open-maps-card-header { display: flex; align-items: center; padding: 6px 4px; gap: 6px; }

#sidepanel-openMaps .open-maps-drag-handle { cursor: grab; display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 16px; color: #5f6368; font-size: 1.8em; }
#sidepanel-openMaps .layer-handle { font-size: 1.8em; }
#sidepanel-openMaps .open-maps-drag-handle:active { cursor: grabbing; }

#sidepanel-openMaps .open-maps-text-container { flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 0px; }

/* NATIVE RELATIVE (EM) FONTS */
#sidepanel-openMaps .title {
  font-weight: normal;
  font-size: 1.2em;
  color: var(--content_primary, #3c4043);
  margin: 0; border: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; line-height: 1.4;
}

#sidepanel-openMaps .additional-info {
  font-style: normal;
  font-size: 0.85em;
  color: var(--content_secondary, #70757a);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; margin: 0; line-height: 1.3;
}

#sidepanel-openMaps .maps-menu-item .buttons { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.open-maps-icon-button { color: #5f6368; background: transparent; border: none; border-radius: 4px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s, color 0.2s; cursor: pointer; outline: none; font-size: 1.1em; margin: 0; padding: 0; }
.open-maps-icon-button:hover { background-color: var(--background_variant, #f1f3f4); color: var(--content_primary, #202124); }
.open-maps-icon-button.fa-info-circle { color: #337ab7; cursor: help; display: none; }

/* Orange warnings: Font Awesome exclamation-circle — same font rendering as eye / triangle icons */
#sidepanel-openMaps .open-maps-orange-exclaim-circle-btn.fa-exclamation-circle {
  color: #f9a825;
  font-size: 1em;
  line-height: 1;
}
#sidepanel-openMaps .open-maps-orange-exclaim-circle-btn:hover {
  background: var(--background_variant, #f1f3f4);
  color: #f57c00;
}
#sidepanel-openMaps .open-maps-orange-fa-inline {
  color: #f9a825;
  font-size: 12px;
  line-height: 1;
  vertical-align: -0.08em;
}
#sidepanel-openMaps .open-maps-orange-fa-inline--gap {
  margin-right: 6px;
}
#sidepanel-openMaps .open-maps-maplayers-summary-warning {
  margin-left: 6px;
  color: #f9a825;
  font-size: 12px;
  vertical-align: -0.08em;
}
#sidepanel-openMaps .open-maps-tou-probe-fail-icon {
  color: #d93025;
  font-size: 13px;
  vertical-align: -0.06em;
}

/* Edit Panel - NATIVE RELATIVE FONTS */
#sidepanel-openMaps .maps-menu-item > div.edit-panel {
  padding: 8px 0px 8px 10px;
  background-color: var(--background_variant, #f8f9fa);
  border: 1px solid var(--border_subtle, #e8eaed);
  border-radius: 8px;
  margin-top: 4px;
  box-sizing: border-box;
  width: 100%;
  font-size: 1.0em; /* Readable standard text slightly smaller than base */
}
#sidepanel-openMaps .maps-menu-item > div.edit-panel > p { font-weight: bold; margin: 0 0 6px 0; padding: 0; font-size: 1.05em; }

/* 2. DECREASE SPACE AMONG LAYER CARDS */
#sidepanel-openMaps .maps-menu-item .edit-panel .openmaps-map-list {
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto; overflow-x: hidden; max-height: 25vh; padding-right: 4px; margin-top: 4px; box-sizing: border-box;
}

#sidepanel-openMaps .layer-card { margin-bottom: 0px; }
#sidepanel-openMaps .layer-card-header { padding: 3px 6px; overflow: visible; }

#sidepanel-openMaps .open-maps-layer-card-menu-panel {
  position: fixed;
  z-index: 10050;
  min-width: 200px;
  margin: 0;
  padding: 4px 0;
  box-sizing: border-box;
  background: var(--background_default, #fff);
  border: 1px solid #dadce0;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.18);
}
#sidepanel-openMaps .open-maps-layer-card-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 8px 14px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  color: var(--content_primary, #202124);
}
#sidepanel-openMaps .open-maps-layer-card-menu-item:hover {
  background: var(--background_variant, #f1f3f4);
}

#sidepanel-openMaps .open-maps-map-copy-menu-panel {
  position: fixed;
  z-index: 10050;
  min-width: 260px;
  margin: 0;
  padding: 4px 0;
  box-sizing: border-box;
  background: var(--background_default, #fff);
  border: 1px solid #dadce0;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.18);
}
#sidepanel-openMaps .open-maps-map-copy-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 8px 14px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  color: var(--content_primary, #202124);
}
#sidepanel-openMaps .open-maps-map-copy-menu-item:hover {
  background: var(--background_variant, #f1f3f4);
}

input.open-maps-opacity-slider { vertical-align: middle; display: inline; margin-left: 8px; width: 100px; height: 10px; }

.open-maps-maximum-layers { border-radius: 8px; padding: 8px; background-color: #fff; }
.open-maps-maximum-layers h3 { margin-bottom: 15px; font-size: 1em; font-weight: 700; }

.open-maps-query-window { display: none; top: 40px; left: 100px; right: 60px; max-height: calc(100% - 80px); overflow-y: auto; background-color: var(--background_default, #fff); border: 2px solid var(--border_subtle, #ddd); padding: 5px; color: var(--content_primary, #000); cursor: auto; z-index: 10000; position: absolute; }
.open-maps-query-window .hidden { display: none; }
.open-maps-query-window-toolbar-wz { vertical-align: middle; margin: 0 2px; line-height: 1; }
.open-maps-query-window-toolbar-wz:hover { opacity: 0.9; }
.open-maps-query-window-button-left, .open-maps-query-window-button-right { cursor: pointer; }
.open-maps-query-window-button-left { float: left; }
.open-maps-query-window-button-right { float: right; }
.open-maps-query-window h2 { text-align: center; font-weight: bold; margin-bottom: 0.5em; color: var(--content_primary, inherit); }
.open-maps-query-window table td { user-select: text; }

#sidepanel-openMaps .openmaps-sidebar-footer { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; margin-top: 8px; font-size: 11px; line-height: 1.35; }
#sidepanel-openMaps .openmaps-sidebar-footer-version { color: var(--content_secondary, #70757a); min-width: 0; font-size: inherit; }
#sidepanel-openMaps .openmaps-sidebar-footer-help { cursor: pointer; color: var(--link_primary, #1a73e8); flex-shrink: 0; }
/* Footer wz-button: match 11px (global .openmaps-wz-btn-compact uses 10px) */
#sidepanel-openMaps .openmaps-sidebar-footer wz-button.openmaps-wz-btn-compact {
  font-size: 11px;
  line-height: 1.35;
  --wz-font-size-label-small: 11px;
  --wz-font-size-body-small: 11px;
}

.openmaps-sidebar-notice { margin-bottom: 12px; padding: 10px; border-radius: 8px; border: 1px solid var(--border_subtle, #dadce0); background: var(--background_variant, #f8f9fa); color: var(--content_primary, #3c4043); font-size: 12px; line-height: 1.4; }
.openmaps-sidebar-notice--update { border-color: #1a73e8; background: #e8f0fe; }
.openmaps-sidebar-notice--tou { border-color: #f9a825; background: #fff8e1; }
.openmaps-sidebar-notice-body { margin: 0 0 8px 0; white-space: pre-wrap; font-family: inherit; font-size: 11px; max-height: 40vh; overflow-y: auto; }
.openmaps-sidebar-notice-message { margin-bottom: 8px; }

#sidepanel-openMaps .openmaps-add-map-viewport-hint { display: none; font-size: 11px; color: var(--content_secondary, #70757a); margin-top: 6px; line-height: 1.35; }

/* Compact wz-button text + tighter remove row */
#sidepanel-openMaps wz-button.openmaps-wz-btn-compact,
.openmaps-sidebar-notice wz-button.openmaps-wz-btn-compact {
  font-size: 10px;
  line-height: 1.25;
  --wz-font-size-label-small: 10px;
  --wz-font-size-body-small: 10px;
}
#sidepanel-openMaps wz-button.openmaps-wz-btn-icon-only,
.openmaps-sidebar-notice wz-button.openmaps-wz-btn-icon-only {
  min-height: 22px;
  padding: 0;
  width: auto;
}
/* Custom Remove Button Styling */
.open-maps-remove-container { display: flex; justify-content: space-between; align-items: center; gap: 6px; width: 100%; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border_subtle, #e8eaed); }
.open-maps-remove-container-left { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; flex: 1; min-width: 0; justify-content: flex-start; }
.open-maps-remove-container .openmaps-wz-btn-icon-only { flex-shrink: 0; }
.open-maps-remove-map-wz { font-weight: 500; color: #d93025; }
.open-maps-remove-map-wz i.fa { font-size: 12px; }
`;
  }
  if (!styleElement.parentNode) {
    document.head.appendChild(styleElement);
  }
  //#endregion
}

function log(message) {
  if (typeof message === 'string') {
    console.log('%cWME Open Maps: %c' + message, 'color:black', 'color:#d97e00');
  } else {
    console.log('%cWME Open Maps:', 'color:black', message);
  }
}

//#region OpenMapsBoot
var openMapsReadyLaunchStarted = false;
var openMapsReadyFallbackTimer = null;

function openMapsLaunchWhenReady(trigger) {
  if (openMapsReadyLaunchStarted) return;
  openMapsReadyLaunchStarted = true;
  if (openMapsReadyFallbackTimer) {
    clearTimeout(openMapsReadyFallbackTimer);
    openMapsReadyFallbackTimer = null;
  }
  log('Launching OpenMaps (' + trigger + ')...');
  onWmeReady();
}

function onWmeInitialized() {
  // Use the official SDK-ready state
  if (W?.userscripts?.state?.isReady) {
    openMapsLaunchWhenReady('state ready');
  } else {
    log('WME structure loaded, waiting for "wme-ready" signal...');
    document.addEventListener('wme-ready', function() {
      openMapsLaunchWhenReady('wme-ready event');
    }, { once: true });
    if (openMapsReadyFallbackTimer) clearTimeout(openMapsReadyFallbackTimer);
    // Bridge builds occasionally miss `wme-ready`; fire once anyway and let onWmeReady poll OL/W.map.
    openMapsReadyFallbackTimer = setTimeout(function() {
      openMapsLaunchWhenReady('wme-ready fallback timeout');
    }, 2500);
  }
}

function bootstrap() {
  openMapsInstallHideGooglePlacesSearchThisAreaChip();
  if (typeof W === 'object' && W.userscripts?.state?.isReady) {
    onWmeInitialized();
  } else {
    // Listen for the earliest possible initialization event
    document.addEventListener('wme-initialized', onWmeInitialized, { once: true });
  }
}

bootstrap();
//#endregion OpenMapsBoot
