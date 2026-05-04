# wandr dashboard cards

These are small, pasteable Lovelace card snippets for building a wandr dashboard one piece at a time.

The goal is to avoid one giant dashboard file. Use only the pieces you want.

## Design approach

- Cards are intentionally granular.
- Cards prefer Home Assistant theme variables instead of hard-coded colors.
- The green wandr accent only appears through `--wandr-accent-color`, with a fallback to Home Assistant's `--primary-color`.
- Entity inputs stay as normal Home Assistant controls where that is more usable than forcing everything into buttons.

## Optional theme variable

Add this to your HA theme if you want a wandr-specific accent color:

```yaml
wandr-accent-color: '#24B33B'
```

If you do not set it, the cards use your theme's primary color.

## Cards

### Route summary

```yaml
!include /config/cards/wandr/route_summary_card.yaml
```

Shows the current route name and the core route stats.

### Route stats chips

```yaml
!include /config/cards/wandr/route_stats_chips_card.yaml
```

Shows distance, duration, elevation, and quality as separate compact tiles.

### Route remote

```yaml
!include /config/cards/wandr/route_remote_card.yaml
```

A universal-remote-style control pad for route selection and completion.

### Google Maps button

```yaml
!include /config/cards/wandr/google_maps_button_card.yaml
```

Large button that opens the generated Google Maps URL.

### Map iframe

```yaml
!include /config/cards/wandr/map_card.yaml
```

Embeds `/local/wandr/current_route.html`.

### Directions iframe

```yaml
!include /config/cards/wandr/directions_card.yaml
```

Embeds `/local/wandr/current_directions.html`.

### Basic setup

```yaml
!include /config/cards/wandr/basic_setup_card.yaml
```

Start/end address, route type, route style, target miles, pace, and fallback toggle.

### A-to-B setup

```yaml
!include /config/cards/wandr/a_to_b_setup_card.yaml
```

A-to-B goal controls.

### Progress

```yaml
!include /config/cards/wandr/progress_card.yaml
```

Streak, weekly walks, weekly miles, and monthly miles.

### Avoid street

```yaml
!include /config/cards/wandr/avoid_street_card.yaml
```

Street/section blocking controls.

### Export / backup

```yaml
!include /config/cards/wandr/export_backup_card.yaml
```

Settings import/export and generated file URLs.

## Example stack

```yaml
type: vertical-stack
cards:
  - !include /config/cards/wandr/route_summary_card.yaml
  - !include /config/cards/wandr/route_stats_chips_card.yaml
  - !include /config/cards/wandr/route_remote_card.yaml
  - !include /config/cards/wandr/google_maps_button_card.yaml
  - !include /config/cards/wandr/map_card.yaml
```

## Note about includes

Home Assistant only supports `!include` from YAML dashboards/configuration, not from the visual editor's raw card editor. If you use the visual editor, paste the card YAML directly instead.
