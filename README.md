# Survivor Season Visualizer

A spoiler-aware dashboard of every completed US season of *Survivor*. Each
season is a card of player lifelines: who was on which tribe, when tribes
swapped or merged, individual and tribe immunity wins, and how and when each
player left. Results stay blurred until you reveal a season. Lines in the left
margin join a returning player's seasons, and each season lists the earlier
seasons to watch first for its returning players' backstories.

Domain terms are defined in [CONTEXT.md](CONTEXT.md).

## Develop

Requires Node 23.6 or later (the scripts are TypeScript run by Node directly).

```sh
npm install
npm run data      # download survivoR tables, write public/data/seasons.json
npm run photos    # optional: fetch player photos into public/photos
npm run dev       # http://localhost:5173
npm test          # data conversion and layout tests
npm run build     # type-check and build the static site into dist/
```

`npm run data -- --refresh` downloads the survivoR tables again. Seasons that
have not finished airing are left out.

## Hand-edited data

- `data/purple-rock.json`: one Purple Rock Podcast link per season. Their URLs
  contain episode titles, so they cannot be generated; seasons without an
  entry link to a site search.
- `data/photo-overrides.json`: the Survivor Wiki page to take a player's photo
  from, by survivoR `castaway_id`, when the default page is wrong. Set an entry
  to `null` to show initials instead.

## Credits

- Season data: [survivoR](https://github.com/doehm/survivoR) by Daniel Oehm,
  MIT License. The license ships with the data as
  `data/SURVIVOR-DATA-LICENSE.md`; the test fixture in `tests/fixtures` is a
  subset of the same data.
- Player photos: © CBS, via [Survivor Wiki](https://survivor.fandom.com/).
  Photos are fetched at build time and never committed. To remove them, skip
  `npm run photos` and rebuild; cards fall back to initials.
- A fan project, not affiliated with CBS or the makers of *Survivor*.

`mockups/` holds the clickable design mockups (fictional data) used to settle
the layout.
