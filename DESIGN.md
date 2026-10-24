---
name: BlindTender
description: A quiet evidence thread for confidential procurement.
colors:
  ink: "#171717"
  muted: "#5e5e5e"
  soft: "#737370"
  line: "#dededc"
  surface: "#f6f6f4"
  surface-dark: "#ededeb"
  white: "#fff"
  focus: "#111"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "46px"
    fontWeight: 620
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "22px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "19px"
    fontWeight: 650
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "14px"
    fontWeight: 600
  action:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "15px"
    fontWeight: 620
    lineHeight: 1.2
rounded:
  field: "8px"
  pill: "999px"
  dot: "50%"
spacing:
  compact: "8px"
  control: "12px"
  reading: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    typography: "{typography.action}"
    rounded: "{rounded.pill}"
    padding: "11px 19px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.pill}"
    padding: "11px 19px"
    height: "48px"
---

# Design System: BlindTender

## Overview

**Creative North Star: “The Quiet Evidence Thread”**

BlindTender is a chain-of-custody instrument for one procurement event. A five-stage line keeps rules, bids, closure, award, and payment connected; a centered work area gives the current task room to read. The visual direction follows the user-pinned black-and-white discipline, clear large type, generous whitespace, rounded high-contrast controls, and short purposeful transitions. It takes the cited PamoSafe interface as a mood and layout reference without using its branding or content.

The interface stays flat and legible. Fine gray rules organize evidence rows and separate sections, while role and stage controls make the active state clear. Hashes, proofs, and trust notes remain in disclosure sections until a user asks to inspect them. Each screen focuses on its current task instead of presenting the complete operating model.

Motion marks a state change and then stops: controls respond quickly, the evidence line advances, and the active workspace enters once. Reduced-motion preferences remove the movement and smooth scrolling.

**Key Characteristics:**

- Strictly monochrome, high-contrast surfaces.
- One centered task area with evidence details progressively disclosed.
- A persistent five-stage evidence thread.
- Quiet, finite motion with reduced-motion support.

## Colors

The palette uses working black, white, and a small range of neutral grays; status and hierarchy do not depend on a bright accent.

### Primary

- **Working Ink**: Wordmark, headings, active stage markers, focus states, and primary actions.

### Neutral

- **White**: Main page and form-control surface.
- **Reading Gray**: Supporting copy, timestamps, labels, and explanatory text.
- **Quiet Gray**: Inactive navigation and secondary status text.
- **Rule Gray**: Thin separators around evidence rows and workspace sections.
- **Paper Tint**: Select result and loading surfaces.
- **Ground Gray**: Skeleton loading bars.

### Named Rules

**The Monochrome Rule.** Keep hierarchy and state in ink, neutral tints, line position, and text labels. Do not add a chromatic accent.

## Typography

- **Display Font:** System UI sans-serif stack
- **Body Font:** System UI sans-serif stack
- **Label/Mono Font:** System sans-serif for labels; system monospace for hashes.

**Character:** Direct, open, and quietly operational. Large, tightly tracked task headings pair with readable body copy; labels and evidence metadata stay plain and compact.

### Hierarchy

- **Display** (weight 620, 46px desktop / 38px below 760px / 34px below 480px, line-height 1.08): The current task heading.
- **Headline** (weight 650, 22px; 20px below 480px, line-height 1.25): Stage section headings.
- **Title** (weight 650, 19px): Smaller section titles and result names.
- **Body** (weight 400, 16px / 1.5; 15px on narrow screens): Explanations and task summaries, generally kept near 64–70ch.
- **Label** (weight 600, 13–15px): Field labels, stage names, counts, and evidence status.
- **Action** (weight 620, 15px): Button labels; small actions reduce to 14px.

Use system monospace for hashes and allow them to wrap anywhere. Receipt counts use tabular numerals where they appear as compact counters.

### Named Rules

**The Task-First Type Rule.** Give the current task the largest type on the screen. Keep evidence labels clear and readable; do not shrink hashes or statuses to create density.

## Layout

The desktop page uses a centered shell capped at 1024px, with a narrower 780px workspace inside it. The stage thread spans the shell above the task heading. Evidence is arranged as ruled rows rather than a grid of cards, leaving generous open space around the primary task. The top bar aligns the wordmark and tender name to the left and the role switcher to the right.

At 760px, the header wraps and the shell narrows; at 480px, forms become a single column, evidence rows stack, and actions can fill the available width. The five-stage thread remains horizontal at mobile widths. Keep the page usable from 390px upward and do not let long hashes force horizontal scrolling.

The spacing rhythm favors 8px increments for control details, 12–16px for local grouping, and roughly 24px or more between sections. Desktop shell padding is responsive; the task area retains comfortable side gutters on small screens.

## Elevation & Depth

The system is flat. It uses no card shadows or raised panels; thin rules, restrained gray surfaces, and the current-stage ring provide the necessary separation. Focus and current-stage halos are state indicators, not ambient elevation.

### Named Rules

**The Flat Evidence Rule.** Use whitespace and fine rules to group evidence. Do not add card stacks, drop shadows, or decorative dashboard chrome.

## Shapes

Primary and secondary actions and the role switcher use fully pill-shaped corners. Form fields use gently rounded corners (8px); stage markers are circles. Evidence sections use square edges and separator rules, keeping the page from feeling like a stack of cards.

## Components

### Buttons

Buttons are high-contrast, rounded, and sized for direct action. Their visual weight distinguishes the main step from supporting choices.

- **Shape:** Pill ends (999px); compact variants retain the same silhouette.
- **Primary:** Working Ink fill with white text; 48px minimum height and 11px × 19px padding.
- **Secondary:** White fill, ink text, and a 1px ink border; same default height and padding as primary.
- **Hover / Active:** A subtle neutral fill shift on hover and a brief 0.98 scale on press.
- **Focus:** A visible 2px outline with 3–4px offset.
- **Disabled:** Muted gray fill and text with the pointer disabled; preserve legible contrast.

### Inputs / Fields

Fields use a white background, a 1px neutral border, 8px corners, 49px minimum height, and 11px × 13px padding. Labels sit above the control with a short gap. Focus darkens the border and adds a quiet 2px ring; preserve the visible keyboard focus treatment.

### Navigation

The stage navigation is one horizontal five-step thread. A one-pixel rule connects circular markers; completed and current stages fill in ink, and the current marker gets a light ring. Keep the active step both visually marked and programmatically identified. On mobile, keep the labels and thread on one line.

The role switcher is a bordered pill group. Its selected role becomes a solid ink pill; unselected roles remain transparent with muted text. Use the selected state to clarify whose view is active.

### Signature Components

- **Evidence rows:** Receipt and rule summaries sit between fine horizontal rules. Labels remain muted; the evidence value and status receive the stronger ink weight. Stack label and value on narrow screens.
- **Closure confirmation:** Before signing, show the acknowledged receipt count, the number included in the accepted set, and whether an omission challenge was selected. Keep this confirmation as a plain ruled block, not a modal or card.
- **Private receipt action:** The private receipt bundle download is a secondary pill action in the supplier view. Keep its explanatory privacy note adjacent and do not surface that action in the buyer view.
- **Progressive disclosure:** Native disclosure summaries reveal manifests, hashes, trust notes, and public evidence on demand. Give summaries a clear text label and keyboard focus.
- **Feedback:** Status and error messages use a restrained tinted surface and border. Pair any state color with explicit text.

## Do's and Don'ts

### Do:

- **Do** keep the page monochrome and reserve Working Ink for emphasis, selected states, and primary actions.
- **Do** keep one primary task in view and reveal hashes, proofs, bid details, and trust notes through labeled disclosures.
- **Do** keep the five-stage evidence thread visible and make its current stage clear to sighted and assistive-technology users.
- **Do** wrap hashes and preserve their ability to be selected and copied.
- **Do** keep transitions short and honor `prefers-reduced-motion` for animation, transitions, and scrolling.

### Don't:

- **Don't** introduce blue, green, red, or another accent hue into the interface.
- **Don't** turn evidence into decorative terminal chrome, dense dashboard cards, or tiny labels.
- **Don't** show every bid detail, hash, proof, and trust explanation in the default view.
- **Don't** rely on color alone to communicate an outcome.
- **Don't** use perpetual or attention-seeking animation.
