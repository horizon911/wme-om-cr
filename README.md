# WME OpenMaps (Candy Remix)

A performance-focused fork of the original [WME OpenMaps](https://github.com/Glodenox/wme-om) by Tom Glodenox Puttemans.

The script adds [Waze Map Editor](https://www.waze.com/editor) overlays for open-data maps (cadastres, orthophotos, boundaries, custom layers) on the editing canvas. Candy Remix targets the modern WME SDK, a tighter sidebar UI, and stronger cartography tools for heavy use.

## Key features

- **Rendering:** CSS blend modes plus live controls for opacity, brightness, contrast, saturation, and gamma.
- **UI:** Sidebar rebuilt for metadata, bounds, and compact map badges.
- **SDK:** Uses the official WME SDK where possible for stability across WME updates.
- **Async layer sync:** Keeps the editor responsive while map state updates. Per-map **Source & Waze** links Waze [Map Data Attribution](https://support.google.com/waze/answer/12075833) and an optional [layer request form](https://docs.google.com/forms/d/e/1FAIpQLSckKm-9hDRALxD2qhngvffzFppOS9C8FDD2w8yuiIE0En8Q8A/viewform); provider terms are informational.

## Installation

1. Install a userscript manager (for example [Tampermonkey](https://www.tampermonkey.net/)).
2. Install the script from Greasy Fork: [WME OpenMaps (Candy Remix)](https://greasyfork.org/scripts/570591-wme-openmaps-candy-remix) (or use the [direct `.user.js` URL](https://update.greasyfork.org/scripts/570591/WME%20OpenMaps%20%28Candy%20Remix%29.user.js)).
3. Reload WME. The **OpenMaps** tab appears in the left sidebar.

## Changelog

Major user-visible changes only (at most one section per calendar day). Full version history: [Greasy Fork](https://greasyfork.org/scripts/570591-wme-openmaps-candy-remix/versions) and git commits.

### 2026.04.18

- **JSON catalogs:** Subscribe to a portable map list from an **HTTPS URL** (refreshed when you load WME) or load a **local JSON file** (up to **5 MB** and **2000** maps). Imported maps use collision-free ids; sub-layer tags show **JSON catalog** where relevant.
- **Export:** In **Manage your maps**, use **Export catalog** to pick **Active** and **Library** rows (with an origin column so duplicates are clear) and download a JSON bundle you can share or re-import.

### 2026.04.15

- **XYZ overlays:** Zooming past a layer's catalog max zoom no longer builds broken tile URLs (empty map). Tile level and indices clamp to the layer's zoom band so the last good zoom **overzooms** instead of failing.

### 2026.04.12

- **Maps not on Waze's attribution list:** Those catalog entries stay out of **Maps to add** (and **Active maps** restore) unless developer mode is on, or you add them under the stricter **Source & Waze** rules (locked until you agree per map).
- **UI:** Clearer **Not accredited** / **Source & Waze** flow for locked rows (compact chip, keyboard-friendly).

### 2026.04.11

- **Source & Waze:** Replaces a single global Terms step with per-map **Source & Waze** (Waze accreditation vs provider info, optional links and forms). Easier to see what is accredited and what is optional.

### 2026.04.08

- **Layer styling:** Optional **layer-specific styles** for ESRI, KML/My Maps, WMS, and ArcGIS MapServer rows (colors and symbols), saved with your map state.
- **KML:** Better map clicks and colors aligned with folders and Map Inspector.

### 2026.04.07

- **Map layers:** Sub-layer header shows **visible/total** counts; **Show all layers** / **Hide all layers** from the layer header actions menu.
- **KML / My Maps:** More reliable drawing, folders, and Map Inspector sync after load and pan; **French** and **Portuguese (Brazil)** for selected Map Inspector strings.

### 2026.04.06

- **Sub-layers:** Clearer origin tags, per-folder colors on the map and in Map Inspector, and smoother toggles between sidebar, map, and inspector (KML/My Maps and ESRI).

### 2026.04.05

- **Your maps:** Upload a local **.kml** file (plain XML; KMZ not supported) and keep it alongside other custom maps.
- **Google My Maps & KML:** Better handling of NetworkLink stubs and folder-based sub-layers; Map Inspector groups hits under folder headers.

### 2026.04.04

- **Satellite & overlays:** Less conflict between WME satellite imagery and heavy vector overlays (Google My Maps / ESRI); optional diagnostics for advanced troubleshooting.

### 2026.04.03

- **Map Inspector:** Highlights and FeatureServer symbols stack more predictably above WME UI (e.g. Places); startup is more resilient if `wme-ready` is slow in Tampermonkey.

### 2026.04.02

- **Map Inspector / ESRI:** Clearer backend tag for WMS vs WFS queries; FeatureServer points and hover/selection behavior refined.

### 2026.04.01

- **Catalog:** Added optional UNESCO-related **FeatureServer** point layers (World Heritage) for quick overlay use.

### 2026.03.30

- **WMS:** Maps can request tiles at a **minimum effective zoom** so zoomed-out views stay within server scale rules without spamming invalid scales.

### 2026.03.29

- **Stability:** Fixed a crash when a WMS layer catalog finished loading with every sub-layer turned off.
- **Czech cadaster (ČÚZK):** Zoom range and on-map hints aligned with official parcel scale limits.

## Acknowledgements

Thanks to **Tom Glodenox Puttemans** for the original WME OpenMaps. This remix exists to keep that idea fast, stable, and aligned with the current editor.
