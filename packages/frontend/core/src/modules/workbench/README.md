# Workbench

```
 ┌─────────────Workbench─────-----──────┐
 |  Tab1 | Tab2 | Tab3            - □ x |
 │ ┌───────┐ ┌───────┐ ┌───────┐ ┌──────┤
 │ │header │ │header │ │header │ │      │
 │ │       │ │       │ │       │ │ side │
 │ │       │ │       │ │       │ │ bar  │
 │ │ view  │ │ view  │ │ view  │ │      │
 │ │       │ │       │ │       │ │      │
 │ │       │         │ │       │ │      │
 │ │       │ │       │ │       │ │      │
 │ └───────┘ └───────┘ └───────┘ │      │
 └───────────────────────────────┴──────┘
```

`Workbench` is the window manager in PolyMind, including the main area and the right sidebar area.

`View` is a managed window under the workbench. Each view has its own history(Support go back and forward) and currently URL.
The view renders the content as defined by the router ([here](../../router.tsx)).
Each route can render its own `Header`, `Body`, and several `Sidebar`s by [ViewIsland](./view/view-islands.tsx).

The `Workbench` manages all Views and decides when to display and close them.
There is always one **active View**, and the URL of the active View is considered the URL of the entire application.

## Sidebar

Each `View` can define its `Sidebar`, which will be displayed in the right area of ​​the screen.
If the same view has multiple sidebars, a switcher will be displayed so that users can switch between multiple sidebars.

> only the sidebar of the currently active view will be displayed.

## Tab

WIP

## Persistence

When close the application and reopen, the entire workbench should be restored to its previous state.
WIP

> If running in a browser, the workbench will passing the browser's back and forward navigation to the active view.
