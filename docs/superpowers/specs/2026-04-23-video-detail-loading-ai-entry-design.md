# Video Detail Loading And AI Entry Design

## Goal

Refine the video detail page so it feels lighter and more polished on entry, while keeping the existing content and behavior intact.

The page should:

- show a lightweight skeleton first instead of a blank or jarring loading state
- reuse cached detail data when available, without visual flashing
- continue fetching fresh data in the background and merge it in when ready
- replace the top-right "原网页" button with the existing AI icon button
- make that AI entry navigate to the `/ai` sub-route

## Scope

This design applies only to the video detail page shell and the top-right header entry.

It does not change:

- the detail data shape
- the comment content or layout
- the video playback behavior
- the download flow
- the `/ai` page itself

## User Experience

### Entry State

When the page opens, the user should see a lightweight skeleton for the main detail content area:

- header area placeholder
- cover or media placeholder
- a small number of card placeholders for description and comments

The skeleton should be compact and visually close to the existing Bilibili-style single-column layout.

### Cache Behavior

The page should resolve content in this order:

1. in-memory cache for the current session
2. `sessionStorage` cache for the same video detail key
3. network request

If cached data is available:

- it should render quickly
- the skeleton should fade out or be replaced smoothly
- loading should not block the full page longer than necessary

If cached data is not available:

- the skeleton remains visible until the first response arrives

When the network response arrives after cached data is already displayed:

- update the view silently
- avoid resetting the page back to a loading state
- preserve scroll position and interactive state where possible

### AI Entry

The top-right header action should use the existing AI icon treatment instead of text-based "原网页" copy.

Behavior:

- clicking the icon navigates to `/ai`
- the control stays visually aligned with the current header row
- the return button and centered title remain unchanged in placement

## Interaction Model

The page should manage two visual phases:

- `loading skeleton` when nothing usable is ready yet
- `content ready` when cached or fetched detail data is available

For cache-backed rendering, the transition should be:

- skeleton visible
- content hydrated from cache
- optional background refresh
- silent content update if fresh data differs

For network-only rendering, the transition should be:

- skeleton visible
- first response renders content
- subsequent loads use the same cache pipeline

## Implementation Boundaries

The implementation should stay localized:

- detail page shell logic in `VideoDetailPage.tsx`
- page-specific entry styling in `VideoDetailPage.css`
- existing list cache logic may be reused, but detail caching should not be forced into unrelated list hooks
- AI icon reuse should rely on existing app iconography and routing patterns

## Error Handling

If the detail request fails:

- keep the skeleton or show the existing error state
- do not replace a valid cached view with a blank error screen
- if stale cached content exists, prefer showing the cached content with a soft error hint rather than dropping all visible UI

If `sessionStorage` is unavailable or full:

- fall back to in-memory behavior
- do not surface storage errors to the user

If `/ai` navigation is unavailable for any reason:

- the header control should fail safely
- do not block the rest of the page

## Testing

Verify the following manually:

- first visit shows skeleton before content
- revisit of the same detail page reuses cache faster than a cold load
- background refresh does not cause layout jump
- the top-right icon navigates to `/ai`
- the header still keeps back button, centered title, and right-side action on one row
- mobile width preserves the same header alignment and skeleton layout

## Non-Goals

This change does not:

- redesign the full detail page content hierarchy again
- change AI note functionality
- change download task behavior
- add new cache persistence beyond the detail page
- add new API endpoints

