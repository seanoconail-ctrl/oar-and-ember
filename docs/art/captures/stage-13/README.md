# Capture: stage-13

Made by `npm run capture -- stage-13` (src/tools/art/capture.ts and captureSea.ts). Compare with
`docs/art/reference/` (Book 7 section 14) and the art in `docs/art/stage-13/`.

| File | What it is |
|---|---|
| `still.png`, `still@2x.png`, `motion.png`, `compare.png` | Wreck Strand where the steerer gets up, its motion map and the reference beside it (unchanged by this stage) |
| `chart-day.png` (and @2x, `-motion.png`) | The chart by day, the wind fair from the south-west: the sea’s sheen, cloud shadows and gusts over the land, the painted route to Carrick, the weather’s marks |
| `chart-fog.png` (and @2x, `-motion.png`) | The chart in fog: two layers drifting downwind at their own speeds, the token dimmed |
| `chart-storm.png` (and @2x, `-motion.png`) | The chart in a storm: darkened, rain slanting downwind, lightning’s double flicker and bolt, low scud |
| `chart-night.png` (and @2x, `-motion.png`) | The chart by night: the night grade, the moonlit sheen, clouds crossing it |
| `chart-reduced.png` (and @2x, `-motion.png`) | Reduced motion, in fog: the fog one still layer swelling softly, the sea and clouds slower |
| `screen-plot.png` (and @2x) | The plotting screen: Carrick Landing chosen, its course painted with a pin at its end; its watches, landfall, stores and the raid it begins; the weather in words beside its marks |
| `screen-choice.png` (and @2x) | The sea map’s choice, weather rising: press on or shelter, each with what follows from it in words; the watches wait |
| `screen-sail.png` (and @2x) | Under way: rowing into the rising south-westerly, the course marching towards its pin, the watch passing with the clock running on, the landfall in words |
| `voyage-clip.mp4`, `voyage-clip.gif` | 10.0 s at 25 fps (the gif at 1x, 12.5 fps): pressing on from the choice, the boat under way with the words shown |
| `wreck.png` (and @2x, `-motion.png`) | The wreck on its reef (work package C’s scene), on foot, handed off from the voyage |

## Motion with the camera still

| View | Continuous motion |
|---|---|
| Wreck Strand | 93.9% |
| chart-day | 92.5% |
| chart-fog | 99.5% |
| chart-storm | 99.0% |
| chart-night | 90.3% |
| chart-reduced | 82.1% |
| wreck | 96.2% |
| Book 7 threshold | 80.0% (reduced motion 50.0%) |

The chart meets the threshold in every weather, by real moving water, cloud and fog (no waiver).

The script's share of a chart frame in a storm as the stepped capture reads it: 1.21 ms (most stepped frames are not drawn); drawn every frame in Chromium it read about 4.5 ms (package B). Book 2's limit is 5.5 ms.

## Against the reference

The references (`docs/art/reference/wreck-strand-target.png` and `kelda-summer-target.png`) are places walked on foot; the chart is the household's drawn map of the Narrow Sea, so it is compared for the standard's qualities, not its look:

- **Palette and tone**: every chart pixel is a Book 7 palette colour from an authored frame (unit-tested), in the reference's darker North Atlantic ramps: grey-green sea darkening to the deep, cool sand, wet stone, moss and grass; warmth only in the token's sail, the course's madder and the sun mark.
- **Water**: as in the reference, the sea lightens over the shallows to the surf line and darkens over the deep (Rán's Reach darker still); its sheen runs in three sets of crests, where the Stage 12 chart had two and left still water (72.9%).
- **Wind and light**: one wind drives the clouds' shadows, the gusts' sheen over the land, the fog's drift and the rain's slant, as the strand's one wind drives its grass and sand; night has its own grade with a moonlit sheen; storms darken the chart and flash, a double flicker with a bolt.
- **Motion**: 90 to 99.5% of the chart keeps moving with the camera still in every weather (the strand reference's mockup 89.2% with its clouds frozen), 82.1% with reduced motion; no waiver. The wreck on Sgeir Dhubh (package C's scene, on foot) 96.2%: the surf on the skerry, the boat afloat with its crew at the oars, the shingle, thrift and grass of the reef in the strand reference's outline weight, three-step shading and palette (`wreck@2x.png`, looked at in the integration pass).
- **Below the reference**: the chart's land is painted flat, as a map (no plants or animals; the strand's life and decoration belong to places walked on foot); the token is 24 x 16 at the chart's scale and reads best at 2x.
