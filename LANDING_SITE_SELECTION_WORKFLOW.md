# Landing Site Selection Workflow

This file is the working reference for the GLB-assisted landing-site curation used by the mission demo.

## Selection Boundary

- primary landing review band: `-84.2 deg` to `-84.4 deg`
- south-polar science context: retained ice targets inside the broader `-80 deg` to `-90 deg` mission region

The current pass is presentation-grade and tied to `moon.glb`, not to the DEM pipeline.

## Landing Factors

The landing score keeps the earlier mission structure, but several factors are represented as conservative terrain proxies because the current pass is GLB-driven.

### Direct GLB-derived factors

- local terrain safety
- crater-rim stand-off
- contiguous landing-patch continuity
- nearby hazard density
- traverse feasibility toward retained ice targets

### Conservative proxy factors

- illumination proxy from exposed shelves versus enclosed bowls
- communication proxy from horizon openness
- thermal proxy from cold-access proximity without landing inside the deepest bowl
- landing ellipse proxy from patch width and edge clearance
- reachable-ice opportunity from target distance and route access

## Score Formula

```text
LandingScore =
0.24 * Safety +
0.14 * IlluminationProxy +
0.08 * CommunicationProxy +
0.12 * ThermalProxy +
0.14 * EllipseProxy +
0.16 * TraverseFeasibility +
0.12 * ReachableIce -
0.10 * RiskPenalty
```

## Retained Operational Zones

| ID | Class | Name | Lat | Lon | Score | Anchor | Notes |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| `ls-01` | Primary | Outer Shelf Prime | `-84.32` | `342` | `83` | `spi-012` | Far-outer shelf selected to maximize illumination and force the traverse back through the inner hazard field. |
| `ls-02` | Primary | Arc Light Shelf | `-84.24` | `178` | `83` | `spi-007` | Meridian shelf with high visibility and a long inward traverse across central obstacle geometry. |
| `ls-03` | Primary | Sunward Ridge Gate | `-84.32` | `202` | `82` | `spi-007` | Sun-facing outer shelf retained to show a visibly longer bend toward the interior science corridor. |
| `ls-04` | Primary | Eastern Bench Shelf | `-84.24` | `93` | `81` | `spi-004` | Outer eastern bench retained well away from the pole so the route must work around the crater band. |
| `ls-05` | Primary | Traverse Shelf Meridian | `-84.32` | `279` | `80` | `spi-012` | Outer western shelf chosen to emphasize the path-length tradeoff against better illumination. |
| `ls-r1` | Reserve | Eastern Arc Reserve | `-84.32` | `47` | `80` | `spi-003` | Reserve outer-arc shelf with strong illumination and a long inward eastern traverse. |
| `ls-r2` | Reserve | Relief Shelf Reserve | `-84.32` | `340` | `83` | `spi-012` | Reserve far-outer shelf retained as a second high-visibility descent option. |

## Usage Notes

- These sites are for the current mission-demo layer, not for final mission navigation.
- The current pass intentionally keeps landing sites much farther from the pole so illumination tradeoffs are obvious and rover paths cross more obstacle geometry before reaching the south-polar science targets.
- The next upgrade path is DEM-driven slope, roughness, and illumination modelling.
- The app should present the sites as `Primary` and `Reserve` operational zones instead of implying mission-certified landing approval.
