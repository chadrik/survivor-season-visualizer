# Survivor Seasons Dashboard

A spoiler-aware dashboard of Survivor seasons. Each season shows how its players moved through tribes and when each left the game, and links players across the seasons they played.

## Language

### People

**Player**:
A real person who played one or more seasons. The player card describes a Player, not one appearance.
_Avoid_: Contestant (except in Survivor Wiki links), person

**Appearance**:
One Player's run in one Season. Age, occupation, hometown, tribes and exit belong to the Appearance, not to the Player.
_Avoid_: Castaway (in code it currently means Appearance), entry

**Backstory season**:
An earlier Season in which one of this Season's Returning players appeared. Only direct ones count, not the Backstory seasons of those Seasons. "Watch first" lists a Season's Backstory seasons that are not yet Watched.
_Avoid_: Prerequisite, required season

**Returning player**:
A Player with more than one Appearance. A return is not a spoiler: later Appearances are always shown, whether or not earlier Seasons are Watched.

### Seasons

**Version**:
A national edition of the show, such as US or Australia. Only the US Version is shown for now.
_Avoid_: Franchise, country

**Season**:
One edition of the show within a Version, numbered in air order and identified by Version and number (US 3). Shown as "Season 3" while only one Version is shown.

**Tribe**:
A team of players within a Season, identified by name and color.

**Phase**:
A stretch of days during which tribe membership does not change. A Season starts in its first Phase, and each swap, shuffle or merge starts a new one.
_Avoid_: Era, stage

**Merge**:
The Phase change after which all remaining players are in one Tribe.

**Jury**:
The players voted out (or otherwise out) after the jury starts; they vote for the winner.

**Finalists**:
The final 2 or 3 players who face the Jury on the last day.
_Avoid_: Final tribal (that is the event, not the people)

**Vote-out**:
Being voted out at a tribal council. An Appearance can have more than one when the Season has a Second chance.
_Avoid_: Boot, elimination (a Vote-out is not always the end)

**Second chance**:
A twist where voted-out players keep playing apart from the tribes and may return to the game, such as Redemption Island or the Edge of Extinction.
_Avoid_: Redemption (a single twist's name), purgatory, limbo

**Exit**:
The final end of an Appearance: how and on which day the player left the game for good. Each Appearance has exactly one. Kinds: voted out, medically evacuated, quit, drew the wrong rock, lost fire-making, lost a Second chance duel or return challenge, finalist, Sole Survivor.
_Avoid_: Boot (only one kind of Exit)

**Individual immunity**:
A win that protects one player from the vote at one tribal council.

**Tribe immunity**:
A win that protects a whole Tribe from attending one tribal council. Every member of the winning Tribe that day shares it; with three or more Tribes, more than one Tribe can win.

### Viewing

**Lifeline**:
The line that shows one Appearance from Day 1 to its Exit.

**Lane**:
The horizontal track a Lifeline runs along. By default a Lane holds one Appearance from Day 1 through Merges, and changes only at a swap or shuffle.
_Avoid_: Row (the name column's line, which a Lifeline can leave after a swap)

**Order**:
The viewer's choice of how Lanes are arranged within each Tribe: Stable lanes (by first name, the default) or Longest-lasting first.

**Active season**:
The Season the viewer is reading now: the season card under the reading line as they scroll. The player card follows it.

**Watched**:
A Season the viewer has seen. Results of a Watched season are shown; anything that would spoil an unwatched Season stays hidden. The viewer marks it by revealing the season's results; the dashboard does not infer it.
_Avoid_: Unlocked, spoiled
