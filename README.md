# WME OpenMaps (Candy Remix)

A modernized, performance-focused fork of the original [WME OpenMaps](https://github.com/Glodenox/wme-om) script by Tom 'Glodenox' Puttemans. 

This userscript augments the [Waze Map Editor](https://www.waze.com/editor) by allowing editors to overlay external, open-data maps (such as local cadasters, high-resolution orthophotos, and administrative boundaries) directly onto the editing canvas.

The **Candy Remix** focuses on aligning the script with modern WME SDK standards, improving UI/UX density, and adding advanced cartographic tools for power editors.

## Key Features

* **Advanced Visual Adjustments:** Take full control of how layers render with native CSS blend modes (Multiply, Screen, Overlay, etc.), alongside real-time sliders for Opacity, Brightness, Contrast, Saturation, and Gamma.
* **Modernized UI:** A rebuilt sidebar interface featuring clean metadata headers, easily comparable monospace bounding boxes, and compact avatar badges with regional flags.
* **WME SDK Native:** Rewritten to utilize the official Waze Map Editor SDK, ensuring maximum stability and future-proofing against internal Waze rendering updates.
* **Asynchronous Engine:** Background "Terms of Use" validation and map layer state synchronization are handled asynchronously to ensure the editor remains snappy and responsive.

## Installation

1. Ensure you have a userscript manager extension installed in your browser (such as [Tampermonkey](https://www.tampermonkey.net/)).
2. **[Click here to install WME OpenMaps (Candy Remix)](#)** *(Note: Insert your GreasyFork/GitHub raw link here)*.
3. Refresh the Waze Map Editor. The OpenMaps tab () will automatically appear in the left sidebar.

## Changelog

### 2026.03.30

- WMS maps can set `wmsMinEffectiveZoom` (or `minEffectiveZoom`) so tile `GetMap` requests use at least that WME zoom level’s ground resolution when the user is zoomed farther out—more tiles when zoomed out, but friendlier to servers with tight `MaxScaleDenominator` rules. ČÚZK Katastrální mapa enables this at zoom 16 alongside `zoomRange` 16–22.
- When `zoomRange[0]` is set, WMS/XYZ/ESRI overlays skip remote tile URLs below that zoom (local transparent 1×1 instead) so `wmsMinEffectiveZoom` does not trigger server traffic outside the documented band.

### 2026.03.29

- Fix crash when the WMS server layer catalog finished loading while every sub-layer was toggled off (`mergeNewParams` on a missing OpenLayers layer).
- ČÚZK Katastrální mapa: `zoomRange` 16–22 so the “may not display at this zoom” hint matches ČÚZK parcel WMS scale limits and caps native tile resolution consistently.

## Acknowledgements

This project exists entirely thanks to the phenomenal foundational work of **Tom 'Glodenox' Puttemans**. The original WME OpenMaps script is a massive contribution to the global Waze editing community. This "remix" is simply a humble continuation  aimed at keeping the tool fast, stable and visually integrated with the modern editor.
