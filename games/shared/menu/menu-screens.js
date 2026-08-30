// =======================================
// FROM A STORYTELLER - MENU-SCREENS.JS
// Version: 2.0
// Shared menu definitions for all games
// =======================================

export const MenuScreens = {
    create(menu) {
        return {
            title: {
                title: "Main Menu",
                items: [
                    {
                        type: "button",
                        label: "Play",
                        action: () => menu.startGame()
                    },
                    {
                        type: "select",
                        label: "Difficulty",
                        key: "difficulty",
                        source: "sessionOptions",
                        options: ["Easy", "Normal", "Hard"]
                    },
                    {
                        type: "button",
                        label: "Settings",
                        action: () => menu.openScreen("settings", "title")
                    },
                    {
                        type: "button",
                        label: () => menu.getFullscreenLabel(),
                        action: () => menu.toggleFullscreen()
                    }
                ]
            },

            pause: {
                title: "Paused",
                items: [
                    {
                        type: "button",
                        label: "Resume",
                        action: () => menu.resumeGame()
                    },
                    {
                        type: "button",
                        label: "Settings",
                        action: () => menu.openScreen("settings", "pause")
                    },
                    {
                        type: "button",
                        label: () => menu.getFullscreenLabel(),
                        action: () => menu.toggleFullscreen()
                    },
                    {
                        type: "button",
                        label: "Return to Title",
                        action: () => menu.returnToTitle()
                    }
                ]
            },

            settings: {
                title: "Settings",
                items: [
                    {
                        type: "toggle",
                        label: "Sounds",
                        key: "soundEnabled",
                        source: "settings"
                    },
                    {
                        type: "slider",
                        label: "Master Volume",
                        key: "masterVolume",
                        source: "settings",
                        min: 0,
                        max: 100,
                        step: 1
                    },
                    {
                        type: "button",
                        label: "Back",
                        action: () => menu.goBack()
                    }
                ]
            },

            matchResult: {
                title: () => {
                    const result = menu.getScreenData("result", "gameOver")

                    if (result === "victory") return "Victory"
                    if (result === "defeat") return "Defeat"
                    return "Game Over"
                },

                content: () => menu.getScreenData("stats", []),

                items: [
                    {
                        type: "button",
                        label: "Play Again",
                        action: () => menu.startGame()
                    },
                    {
                        type: "button",
                        label: "Return to Title",
                        action: () => menu.returnToTitle()
                    }
                ]
            }
        }
    }
}