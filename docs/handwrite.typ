#set text(font: ("Sarasa Fixed Slab SC"), lang:("zh"))

#show math.equation: set text(font: "Neo Euler")

这篇不一样，是真的手写的。理一下组件吧。

*2026.01.19*

首先最简单的是 `App.svelte` 和 `Navbar.svelte`，除了对 `activePage` 的双向绑定和简单的条件渲染之外，就只有对 IndexedDB 和悬浮球组件的引用。

顺便清理一下 vite init 时用于教学的组件。

别看现在只有 `ApiTest.svelte`、`FloatingBall.svelte` 和 `ApiTest` 这三个核心组件，但实际上他们仨都是重头戏。

嘛，今天的计划还是理一下 `lib/core`，这个定下来以后预计不会动了。当然，肯定要考量 `Dispachter` 的部分。由于现在还没有 `core-runner`，所以得提前考虑，不然 `Dispacher` 和 `core/` 的具体组件也不好设计。

