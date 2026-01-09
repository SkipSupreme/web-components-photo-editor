/**
 * Theme Manager - Handles light/dark theme switching
 * Persists user preference and supports system preference detection
 */

import { getEventBus, Events } from './event-bus.js';
import { saveSetting, getSetting } from '../storage/project-store.js';

const THEME_KEY = 'theme';
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

class ThemeManager {
  constructor() {
    this.currentTheme = THEMES.DARK;
    this.effectiveTheme = THEMES.DARK;
    this.eventBus = getEventBus();
    this.mediaQuery = null;
  }

  /**
   * Initialize theme manager
   */
  async init() {
    // Load saved preference
    const savedTheme = await getSetting(THEME_KEY, THEMES.SYSTEM);
    this.currentTheme = savedTheme;

    // Set up system preference listener
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQuery.addEventListener('change', (e) => {
      if (this.currentTheme === THEMES.SYSTEM) {
        this.applyTheme(e.matches ? THEMES.DARK : THEMES.LIGHT);
      }
    });

    // Apply initial theme
    this.setTheme(savedTheme, false);

    console.log('Theme manager initialized:', this.currentTheme);
  }

  /**
   * Get the current theme setting
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * Get the effective theme (light or dark)
   */
  getEffectiveTheme() {
    return this.effectiveTheme;
  }

  /**
   * Set the theme
   */
  async setTheme(theme, save = true) {
    this.currentTheme = theme;

    // Determine effective theme
    let effectiveTheme;
    if (theme === THEMES.SYSTEM) {
      effectiveTheme = this.mediaQuery?.matches ? THEMES.DARK : THEMES.LIGHT;
    } else {
      effectiveTheme = theme;
    }

    this.applyTheme(effectiveTheme);

    // Save preference
    if (save) {
      await saveSetting(THEME_KEY, theme);
    }

    this.eventBus.emit(Events.THEME_CHANGED, {
      theme: this.currentTheme,
      effectiveTheme: this.effectiveTheme
    });
  }

  /**
   * Apply theme to DOM
   */
  applyTheme(theme) {
    this.effectiveTheme = theme;

    // Set data attribute on root
    document.documentElement.setAttribute('data-theme', theme);

    // Update meta theme-color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === THEMES.DARK ? '#1a1a1a' : '#f5f5f5');
    }

    // Update color-scheme
    document.documentElement.style.colorScheme = theme;

    console.log('Applied theme:', theme);
  }

  /**
   * Toggle between light and dark
   */
  toggle() {
    const newTheme = this.effectiveTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    this.setTheme(newTheme);
  }

  /**
   * Check if dark theme is active
   */
  isDark() {
    return this.effectiveTheme === THEMES.DARK;
  }

  /**
   * Check if light theme is active
   */
  isLight() {
    return this.effectiveTheme === THEMES.LIGHT;
  }
}

// Singleton instance
let instance = null;

/**
 * Get the theme manager instance
 */
export function getThemeManager() {
  if (!instance) {
    instance = new ThemeManager();
  }
  return instance;
}

/**
 * Initialize theme manager
 */
export async function initThemeManager() {
  const manager = getThemeManager();
  await manager.init();
  return manager;
}

export { THEMES };
