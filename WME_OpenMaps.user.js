// ==UserScript==
// @name        WME OpenMaps (Candy Remix)
// @author      Horizon911
// @namespace      https://github.com/horizon911/
// @contributor  Glodenox
// @contributor  petrjanik, d2-mac, MajkiiTelini (Czech WMS layers — ČÚZK definitions)
// @description This userscript augments the Waze Map Editor by allowing editors to overlay external, open-data maps (such as local cadasters, high-resolution orthophotos, and administrative boundaries) directly onto the editing canvas.
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
// @connect     *
// @icon        https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Candy/3D/candy_3d.png
// @downloadURL https://update.greasyfork.org/scripts/570591/WME%20OpenMaps%20%28Candy%20Remix%29.user.js
// @updateURL   https://update.greasyfork.org/scripts/570591/WME%20OpenMaps%20%28Candy%20Remix%29.user.js
// @supportURL  https://github.com/horizon911/wme-om-cr/issues
// @tag         Candy
// @version     2026.03.29.05
// @require     https://bowercdn.net/c/html.sortable-0.4.4/dist/html.sortable.js
// @grant       GM_xmlhttpRequest
// @license     GPL v2
// ==/UserScript==




/* global W, I18n, sortable, OpenLayers, Proj4js, $ */

var styleElement;


async function onWmeReady() {
  // Wait silently for OpenLayers to load (Fixes Zoom 12 wait and bypasses deprecated extent warning)
  if (typeof OpenLayers == 'undefined' || !W.map || !W.map.getOLMap()) {
    setTimeout(onWmeReady, 1000);
    return;
  }


  //#region Set up translations
  var translations = {
    en: {
      tab_title: 'Open Maps',
      maps_title: 'Active Maps',
      no_local_maps: 'No maps found for this area',
      hide_tooltips: 'Hide help',
      show_tooltips: 'Show help',
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
      map_improvement_label: 'Improve map display',
      map_improvement_label_tooltip: 'Apply several improvements to the received map tiles',
      map_layers_title: 'Map layers',
      find_available_layers: 'Find available layers',
      find_available_layers_loading: 'Querying server…',
      layer_catalog_loading: 'Loading layer list from server…',
      find_available_layers_loaded: 'Available layers loaded',
      find_available_layers_retry: 'Fetch failed (click to retry)',
      sync_layers_tooltip: 'Sync layer list from server',
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
      copy_layer_definition: 'Copy layer entry for script (layers: { … })',
      copy_definition_menu: 'Copy definition',
      layer_card_menu: 'More actions',
      copy_layer_definition_done: 'Copied',
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
        EU: 'European Union'
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
        v2026_03_29_05: '- Fix crash when the server layer list finished loading while all WMS sub-layers were hidden'
      }
    },
    nl: {
      tab_title: 'Open Maps',
      maps_title: 'Actieve kaarten',
      no_local_maps: 'Geen lokale kaarten gevonden',
      map_already_selected: 'Deze kaart is al toegevoegd',
      hide_tooltips: 'Hulp verbergen',
      show_tooltips: 'Hulp weergeven',
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
      map_improvement_label: 'Kaartweergave verbeteren',
      map_improvement_label_tooltip: 'Pas allerhande verbeteringen toe op de kaarttegels',
      map_layers_title: 'Kaartlagen',
      find_available_layers: 'Beschikbare lagen zoeken',
      find_available_layers_loading: 'Server bevragen…',
      layer_catalog_loading: 'Lagenlijst van server laden…',
      find_available_layers_loaded: 'Beschikbare lagen geladen',
      find_available_layers_retry: 'Ophalen mislukt (klik om opnieuw te proberen)',
      sync_layers_tooltip: 'Lagenlijst van server synchroniseren',
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
      copy_layer_definition: 'Laagregel voor script kopiëren (layers: { … })',
      copy_definition_menu: 'Definitie kopiëren',
      layer_card_menu: 'Meer acties',
      copy_layer_definition_done: 'Gekopieerd',
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
        EU: 'European Union'
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
        v2026_03_29_05: '- Crash opgelost wanneer de serverlagenlijst klaar was terwijl alle WMS-sublagen uit stonden'
      }
    },
    fr: {
      tab_title: 'Open Maps',
      maps_title: 'Cartes Actives',
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
      copy_layer_definition: 'Copier l’entrée de couche pour le script (layers: { … })',
      copy_definition_menu: 'Copier la définition',
      layer_card_menu: 'Plus d’actions',
      copy_layer_definition_done: 'Copié',
      tou_accept_disabled_tooltip: 'Ouvrez d’abord chaque lien de langue ci-dessus.',
      no_local_maps: 'Aucune carte disponible ici',
      opacity_label: 'Opacité',
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
      map_improvement_label: 'Melhorar a exibição do mapa',
      map_improvement_label_tooltip: 'Aplique várias melhorias nos blocos de mapa',
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
      copy_layer_definition: 'Copiar entrada da camada para o script (layers: { … })',
      copy_definition_menu: 'Copiar definição',
      layer_card_menu: 'Mais ações',
      copy_layer_definition_done: 'Copiado',
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
    'eu-tentec': { name: 'European Commission Legal Notice', links: { 'en': 'https://commission.europa.eu/legal-notice_en' }, selector: 'main' },
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
        try {
          $(element).tooltip('destroy');
        } catch (err) {}
        element.removeAttribute('data-original-title');
        if (!force) {
          var i = elements.indexOf(element);
          if (i !== -1) elements.splice(i, 1);
          element.dataset.title = text;
          elements.push(element);
        }
        var titleStr = useHtml ? String(text).replace(/\n/g, '<br>') : text;
        if (useHtml) {
          element.removeAttribute('title');
          $(element).tooltip(Object.assign({}, opts, { title: titleStr }));
        } else {
          element.title = titleStr;
          $(element).tooltip(opts);
        }
      },
      'remove': function(element) {
        try {
          $(element).tooltip('destroy');
        } catch (err) {}
        element.removeAttribute('data-original-title');
        element.title = '';
        var toRemoveIdx = elements.findIndex(function(el) { return el == element; });
        if (toRemoveIdx !== -1) {
          elements.splice(toRemoveIdx, 1);
        }
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
          var $el = $(el);
          try {
            $el.tooltip('hide');
          } catch (err1) {}
          try {
            $el.tooltip('destroy');
          } catch (err2) {}
          try {
            $el.tooltip('dispose');
          } catch (err3) {}
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
            $(element).tooltip('destroy');
            element.title = '';
          });
        } else {
          elements.forEach(function(element) {
            element.title = element.dataset.title;
            $(element).tooltip(Object.assign({}, defaultOpts));
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

  // Adjust map tile reload attempts (by default set to 0). This also makes OpenLayers attempt to load tiles a second time in other layers
  OpenLayers.IMAGE_RELOAD_ATTEMPTS = 1;

  // List of map handles
  var handles = [];

  //#region Create tab and layer group
  var tab = await (async function() {
    const {tabLabel, tabPane} = W.userscripts.registerSidebarTab('openMaps');

    tabLabel.innerHTML = '<span class="fa"></span>';
    tabLabel.title = I18n.t('openmaps.tab_title');
    tabPane.id = 'sidepanel-openMaps';

    await W.userscripts.waitForElementConnected(tabPane);

    return Promise.resolve(tabPane);
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

// Satellite imagery toggle
// --- CACHED SATELLITE IMAGERY TOGGLE ---
  const wazeSatLayer = W.map.getLayerByName('satellite_imagery');
  const satImagery = document.createElement('wz-checkbox');
  satImagery.checked = wazeSatLayer.getVisibility();

  // Listen for the component to "change" instead of "click"
  satImagery.addEventListener('change', function(e) {
    wazeSatLayer.setVisibility(e.target.checked);
  });

  wazeSatLayer.events.register('visibilitychanged', null, function() {
    // Keep in sync if toggled via Shift+I
    if (satImagery.checked !== wazeSatLayer.getVisibility()) {
      satImagery.checked = wazeSatLayer.getVisibility();
    }
  });

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

  /** Stack OpenMaps tile layers above satellite: first row in sidebar = frontmost among our maps, but never above native WME layers (roads, etc.). */
  function syncOpenMapsLayerIndices() {
    const olMap = W.map.getOLMap();
    const wazeLayers = W.map.getLayers();
    const aerialImageryIndex = Math.max(0, ...wazeLayers.map(l =>
      l.project === 'earthengine-legacy' ? W.map.getLayerIndex(l) : 0
    ));

    const ourLayers = new Set();
    handles.forEach(h => {
      if (h.layer) ourLayers.add(h.layer);
      if (h.bboxLayer) ourLayers.add(h.bboxLayer);
    });

    let minForeignAbove = Infinity;
    for (let li = 0; li < wazeLayers.length; li++) {
      const layer = wazeLayers[li];
      if (ourLayers.has(layer)) continue;
      const idx = W.map.getLayerIndex(layer);
      if (idx > aerialImageryIndex && idx < minForeignAbove) minForeignAbove = idx;
    }

    if (!handles.some(h => h.layer)) return;

    const len = handles.length;
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

    handles.forEach((h, i) => {
      if (!h.layer) return;
      const z = Math.max(floorZ, topIndex - i);
      olMap.setLayerIndex(h.layer, z);
    });

    const maxOurZ = minForeignAbove === Infinity ? Infinity : minForeignAbove - 1;
    handles.forEach(h => {
      if (!h.layer || !h.bboxLayer) return;
      const ti = W.map.getLayerIndex(h.layer);
      let bi = ti + 1;
      if (maxOurZ !== Infinity && bi > maxOurZ) bi = maxOurZ;
      if (bi <= ti) bi = ti;
      olMap.setLayerIndex(h.bboxLayer, bi);
    });
  }

function onMapSort() {
    const nodes = handleList.querySelectorAll('.maps-menu-item');
    const newHandles = [];

    nodes.forEach(node => {
      const h = handles.find(handle => handle.mapId === parseInt(node.dataset.mapId));
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
  W.map.events.register('moveend', null, updateMapSelector);
  // ----------------------------------------------------------------------------------
  // --------------------------------------

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

  //#region Reload previous map(s)
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
        improveMap: mapHandle.improveMap
      }));
      saveMapState();
    });
  }
//#endregion

  // --- NEW: Trigger the Background ToU Engine on boot! ---
  runToUBackgroundChecks();

 // FIX: Force the search list to recalculate AFTER saved maps are restored!
  updateMapSelector();
    refreshMapDrag(); // Make saved maps draggable on boot!

  //#region Implement map query support
  // Add the control to catch a click on the map area for retrieving map information
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
var queryUrl = getFeatureInfoControl.params.url + '?SERVICE=WMS&REQUEST=GetFeatureInfo&STYLES=&BBOX=' + getMapExtent().toBBOX() +
          '&LAYERS=' + getFeatureInfoControl.params.layers + '&QUERY_LAYERS=' + getFeatureInfoControl.params.layers +
          '&HEIGHT=' + W.map.getSize().h + '&WIDTH=' + W.map.getSize().w +
          // FIX: Added FEATURE_COUNT=50 to force the server to return multiple overlapping layers/objects!
          '&VERSION=1.3.0&CRS=EPSG:3857&I=' + e.xy.x + '&J=' + e.xy.y + '&FEATURE_COUNT=50&INFO_FORMAT=text/html';
      // --- MODERNIZED DYNAMIC TITLE ---
          // Uses Optional Chaining to prevent null crashes and Template Literals for the string
          var mapId = getFeatureInfoControl.params?.id;
          var queriedMap = mapId ? maps.get(mapId) : null;
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
          Accept: 'text/xml'
        },
        url: queryUrl,
        timeout: 10000,
        onload: function(response) {
          queryWindowLoading.style.display = 'none';
          if (response.status == 200) {
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
                  maps.get(mapId).query_filters.forEach((func) => {
                    func(queryWindowContent, maps.get(mapId));
                  });

             // --- COMPACT URL COPIER FOR QUERY WINDOW ---
                  // Generates two compact copiers using the universal engine
                  var copier1 = createClipboardCopier('Exact URL:', queryUrl, true);
                  var copier2 = createClipboardCopier('Exact URL:', queryUrl, true);

                  // Insert at the top of BOTH the Processed and Original data views!
                  queryWindowContent.insertBefore(copier1, queryWindowContent.firstChild);
                  queryWindowOriginalContent.insertBefore(copier2, queryWindowOriginalContent.firstChild);
                  // -------------------------------------------

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
      navigator.clipboard.writeText(copyValue).then(function() {
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
    var addedMap = maps.get(parseInt(mapId, 10));
    if (!addedMap) return;
    handles.push(new MapHandle(addedMap));
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
      if (map.area) {
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
        invert: handle.invert
      };
      settings.state.active.push(handleState);
    });
    Settings.put(settings);
  }

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
        waiters.forEach(function(cb) { if (cb) cb(entry.status === 'error' ? new Error(entry.error || 'parse') : null, entry); });
      },
      onerror: function() {
        var entry = sessionLayerCatalog[key];
        entry.status = 'error';
        entry.error = 'network';
        var waiters = entry.waiters || [];
        delete entry.waiters;
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
    this.improveMap = (options && options.improveMap != undefined ? options.improveMap : true);
    this.displayBbox = (options && options.displayBbox ? true : false);
    // NEW: Image Adjustment State
    this.brightness = (options && options.brightness !== undefined ? options.brightness : 100);
    this.contrast = (options && options.contrast !== undefined ? options.contrast : 100);
    this.saturate = (options && options.saturate !== undefined ? options.saturate : 100);
    this.hue = (options && options.hue !== undefined ? options.hue : 0);
    this.gamma = (options && options.gamma !== undefined ? options.gamma : 100);
    this.invert = (options && options.invert ? true : false);
    this.blendMode = (options && options.blendMode ? options.blendMode : 'normal');
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
      try {
        $(UI.error).tooltip('destroy');
      } catch (err) {}
      UI.error.removeAttribute('data-original-title');
      UI.error.title = '';
      Tooltips.add(UI.error, I18n.t('openmaps.retrieving_error'), true);
      UI.error.style.display = 'none';
    };


    // --- 3. UI GENERATORS ---
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

      // 1. PRE-CALCULATE DYNAMIC BACKGROUND COLOR
      var hash = 0;
      for (var i = 0; i < map.title.length; i++) { hash = map.title.charCodeAt(i) + ((hash << 5) - hash); }
      var wazeColors = ['#0099ff', '#8663df', '#20c063', '#ff9600', '#ff6699', '#0071c5', '#15ccb2', '#33ccff', '#e040fb', '#ffc000', '#f44336', '#3f51b5', '#009688', '#8bc34a', '#e91e63'];
      self.bgColor = wazeColors[Math.abs(hash) % wazeColors.length];
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
      if (map.area) {
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
      buttons.appendChild(UI.info);

    // --- ZOOM TO BBOX BUTTON ---
      UI.zoomToBboxBtn = createIconButton('fa-crosshairs', I18n.t('openmaps.zoom_to_map_area'), true);
      UI.zoomToBboxBtn.style.display = 'none'; // Hidden by default
UI.zoomToBboxBtn.addEventListener('click', function(e) {
        e.stopPropagation();

        // Force-hide the floating tooltip bubble before the button disappears
        $(this).tooltip('hide');

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
      metaTop.innerHTML = '<strong>' + I18n.t('openmaps.meta_type') + ':</strong> <span style="background:#e8eaed; padding:1px 4px; border-radius:3px; color:#3c4043; border: 1px solid #dadce0;">' + (map.type || 'WMS') + '</span> &nbsp;|&nbsp; <strong>' + I18n.t('openmaps.meta_region') + ':</strong> ' + (I18n.t('openmaps.areas.' + map.area) || map.area);
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
      if (map.abstract) {
          var metaDesc = document.createElement('div');
          metaDesc.style.cssText = 'margin-top: 6px; font-style: italic; color: #70757a;';
          metaDesc.textContent = map.abstract;
          metaBox.appendChild(metaDesc);
      }
      UI.editContainer.appendChild(metaBox);
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

      if (map.format != 'image/jpeg') {
        var transCheck = document.createElement('wz-checkbox');
        transCheck.checked = self.transparent; transCheck.textContent = I18n.t('openmaps.transparent_label');
        transCheck.addEventListener('change', () => { self.transparent = !self.transparent; self.layer.mergeNewParams({ transparent: self.transparent }); saveMapState(); });
        Tooltips.add(transCheck, I18n.t('openmaps.transparent_label_tooltip'));
        slidersContainer.appendChild(transCheck);
      }

      if (map.hasOwnProperty('pixelManipulations')) {
        var impCheck = document.createElement('wz-checkbox');
        impCheck.checked = self.improveMap; impCheck.textContent = I18n.t('openmaps.map_improvement_label');
        impCheck.addEventListener('change', () => { self.improveMap = !self.improveMap; self.layer.redraw(); saveMapState(); });
        Tooltips.add(impCheck, I18n.t('openmaps.map_improvement_label_tooltip'));
        slidersContainer.appendChild(impCheck);
      }

      var bboxCheck = document.createElement('wz-checkbox');
      bboxCheck.checked = self.displayBbox;
      bboxCheck.textContent = I18n.t('openmaps.draw_bbox_on_map');
      bboxCheck.addEventListener('change', (e) => {
        self.displayBbox = e.target.checked;
        self.updateBboxLayer();
        saveMapState();
      });
      slidersContainer.appendChild(bboxCheck);

      var opacityBox = document.createElement('div');
      opacityBox.style.cssText = 'display:flex; align-items:center; gap:8px; font-size:11px; color:#5f6368;';
      Tooltips.add(opacityBox, I18n.t('openmaps.opacity_label_tooltip'));

      var opLabel = document.createElement('span');
      opLabel.textContent = I18n.t('openmaps.opacity_label') + ':';
      opacityBox.appendChild(opLabel);

      var opSlider = document.createElement('input');
      opSlider.type = 'range'; opSlider.max = 100; opSlider.min = 5; opSlider.step = 5; opSlider.value = self.opacity;
      opSlider.style.cssText = 'width:100px; margin:0; accent-color:#0099ff; cursor:pointer;';

      var opVal = document.createElement('span');
      opVal.textContent = self.opacity + '%';
      opVal.style.cssText = 'font-weight:bold; min-width:35px; color:#3c4043;';

      opSlider.addEventListener('input', function() {
        self.layer.setOpacity(Math.max(5, Math.min(100, this.value)) / 100);
        self.opacity = this.value;
        opVal.textContent = this.value + '%';
      });
      opSlider.addEventListener('change', function() { saveMapState(); });

      opacityBox.appendChild(opSlider);
      opacityBox.appendChild(opVal);
      slidersContainer.appendChild(opacityBox);

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
      var sGamma = createSlider(I18n.t('openmaps.slider_gamma'), 'gamma', 10, 200, '%');;
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
      slidersContainer.appendChild(blendRow);
      // -----------------------------
      var invRow = document.createElement('div');
      var invCheck = document.createElement('wz-checkbox');
      invCheck.textContent = I18n.t('openmaps.invert_colors');
      invCheck.checked = self.invert;
      invCheck.addEventListener('change', (e) => { self.invert = e.target.checked; self.applyFilters(); saveMapState(); });
      invRow.appendChild(invCheck);

      var resetBtn = document.createElement('wz-button');
      resetBtn.className = 'openmaps-wz-btn-compact';
      resetBtn.setAttribute('size', 'sm'); resetBtn.setAttribute('color', 'secondary');
      resetBtn.textContent = I18n.t('openmaps.reset_visual_default');
      resetBtn.style.marginTop = '5px';
      resetBtn.addEventListener('click', () => {
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

      [sBright.row, sContrast.row, sSaturate.row, sHue.row, sGamma.row, invRow, resetBtn].forEach(el => slidersContainer.appendChild(el));
      advColors.appendChild(slidersContainer);
      UI.editContainer.appendChild(advColors);





  

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

        var layerMenuRoot = document.createElement('div');
        layerMenuRoot.className = 'open-maps-layer-card-menu-root';
        layerMenuRoot.style.cssText = 'position:relative; display:inline-block;';

        var layerMenuBtn = createIconButton('fa-ellipsis-v', I18n.t('openmaps.layer_card_menu'), true);
        var layerMenuPanel = document.createElement('div');
        layerMenuPanel.className = 'open-maps-layer-card-menu-panel';
        layerMenuPanel.setAttribute('role', 'menu');
        layerMenuPanel.style.display = 'none';

        var copyMenuItem = document.createElement('button');
        copyMenuItem.type = 'button';
        copyMenuItem.className = 'open-maps-layer-card-menu-item';
        copyMenuItem.setAttribute('role', 'menuitem');
        copyMenuItem.textContent = I18n.t('openmaps.copy_definition_menu');
        Tooltips.add(copyMenuItem, I18n.t('openmaps.copy_layer_definition'), true);

        var layerMenuOpen = false;
        function positionLayerMenu() {
          var rect = layerMenuBtn.getBoundingClientRect();
          var pw = layerMenuPanel.offsetWidth || 200;
          layerMenuPanel.style.left = Math.max(8, rect.right - pw) + 'px';
          layerMenuPanel.style.top = (rect.bottom + 2) + 'px';
        }
        function closeLayerMenu() {
          if (!layerMenuOpen) return;
          layerMenuOpen = false;
          layerMenuPanel.style.display = 'none';
          document.removeEventListener('click', onDocCloseLayerMenu);
          document.removeEventListener('keydown', onKeyLayerMenu);
          window.removeEventListener('resize', closeLayerMenu);
          if (UI.mapLayersSubContainer) UI.mapLayersSubContainer.removeEventListener('scroll', closeLayerMenu);
        }
        function onDocCloseLayerMenu(ev) {
          if (layerMenuRoot.contains(ev.target)) return;
          closeLayerMenu();
        }
        function onKeyLayerMenu(ev) {
          if (ev.key === 'Escape') closeLayerMenu();
        }
        function openLayerMenu() {
          layerMenuOpen = true;
          layerMenuPanel.style.display = 'block';
          requestAnimationFrame(function() {
            positionLayerMenu();
            requestAnimationFrame(positionLayerMenu);
          });
          setTimeout(function() {
            document.addEventListener('click', onDocCloseLayerMenu);
            document.addEventListener('keydown', onKeyLayerMenu);
            window.addEventListener('resize', closeLayerMenu);
            if (UI.mapLayersSubContainer) UI.mapLayersSubContainer.addEventListener('scroll', closeLayerMenu, { passive: true });
          }, 0);
        }

        layerMenuBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (layerMenuOpen) closeLayerMenu();
          else openLayerMenu();
        });

        copyMenuItem.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          var snippet = buildLayerDefinitionSnippet(layerItem.name);
          navigator.clipboard.writeText(snippet).then(function() {
            closeLayerMenu();
            copyMenuItem.textContent = I18n.t('openmaps.copy_layer_definition_done');
            setTimeout(function() { copyMenuItem.textContent = I18n.t('openmaps.copy_definition_menu'); }, 1600);
          });
        });

        layerMenuPanel.appendChild(copyMenuItem);
        layerMenuRoot.appendChild(layerMenuBtn);
        layerMenuRoot.appendChild(layerMenuPanel);
        lBtns.appendChild(layerMenuRoot);

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
        UI.syncLayersBtn = createIconButton('fa-refresh', I18n.t('openmaps.sync_layers_tooltip'), true);
        UI.syncLayersBtn.addEventListener('click', function(e) {
          e.preventDefault(); e.stopPropagation();
          UI.syncLayersBtn.classList.add('fa-spin');
          ensureLayerCatalogLoaded(true, function() {
            UI.syncLayersBtn.classList.remove('fa-spin');
          });
        });
        rmLeft.appendChild(UI.syncLayersBtn);

        var capBtn = createIconButton('fa-server', I18n.t('openmaps.server_capabilities_tooltip'), true);
        capBtn.addEventListener('click', function(e) {
          e.preventDefault(); e.stopPropagation();
          openServerCapabilitiesViewer({ forceRefresh: false });
        });
        rmLeft.appendChild(capBtn);
      }

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
      if (self.displayBbox) {
        if (!self.bboxLayer) {
          self.bboxLayer = new OpenLayers.Layer.Vector("BBOX_" + map.id, {
            styleMap: new OpenLayers.StyleMap({
              "default": new OpenLayers.Style({ strokeColor: self.bgColor, strokeWidth: 2, strokeDashstyle: 'dash', fillOpacity: 0 })
            }),
            displayInLayerSwitcher: false
          });
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

      if (visibleLayers.length == 0 && self.layer && ['WMS', 'XYZ', 'ESRI'].includes(map.type)) {
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

        if (map.pixelManipulations) options.tileOptions = { crossOriginKeyword: 'anonymous' };

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

        self.layer.setOpacity(self.opacity / 100);
        self.layer.setVisibility(!self.hidden && !self.outOfArea);

        if (map.zoomRange) {
          self.layer.events.register('moveend', null, obj => {
            if (obj.zoomChanged) {
              var zoom = W.map.getZoom();
              UI.info.style.display = (zoom < map.zoomRange[0] || zoom > map.zoomRange[1] ? 'inline' : 'none');
            }
          });
        }

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
          if (map.pixelManipulations && self.improveMap) manipulateTile(evt, map.pixelManipulations);
        });
        self.layer.events.register('visibilitychanged', null, self.updateVisibility);

        W.map.addLayer(self.layer);
        syncOpenMapsLayerIndices();

      } else if (layerRedrawNeeded) {
        if (self.layer) {
          if (map.type === 'WMS') self.layer.mergeNewParams({ layers: visibleLayers.join() });
          else if (map.type === 'XYZ' || map.type === 'ESRI') self.layer.redraw();
        }
        layerRedrawNeeded = false;
      }
      if (visibleLayers.length > 0 && self.layer && ['WMS', 'XYZ', 'ESRI'].includes(map.type)) {
        self.layer.setVisibility(!self.hidden && !self.outOfArea);
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

function onWmeInitialized() {
  // Use the official SDK-ready state
  if (W?.userscripts?.state?.isReady) {
    log('WME is ready. Launching OpenMaps...');
    onWmeReady();
  } else {
    log('WME structure loaded, waiting for "wme-ready" signal...');
    document.addEventListener('wme-ready', onWmeReady, { once: true });
  }
}

function bootstrap() {
  if (typeof W === 'object' && W.userscripts?.state?.isReady) {
    onWmeInitialized();
  } else {
    // Listen for the earliest possible initialization event
    document.addEventListener('wme-initialized', onWmeInitialized, { once: true });
  }
}

bootstrap();
