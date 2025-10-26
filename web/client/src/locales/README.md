# i18n (Internationalization) Guide

This project uses `react-i18next` for internationalization support.

## Structure

```
locales/
├── en/
│   └── common.json    # English translations
├── es/                # Spanish (future)
├── fr/                # French (future)
└── de/                # German (future)
```

## Usage in Components

### Using the `useTranslation` hook:

```javascript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('common');

  return (
    <div>
      <h1>{t('app.name')}</h1>
      <p>{t('app.description')}</p>
    </div>
  );
}
```

### With interpolation:

```javascript
const { t } = useTranslation('common');

// Translation key in common.json: "welcome": "Welcome, {{name}}!"
<p>{t('welcome', { name: 'John' })}</p>
```

### Changing language:

```javascript
import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <button onClick={() => changeLanguage('es')}>
      Switch to Spanish
    </button>
  );
}
```

## Available Translation Keys

The following namespaces and keys are available in `common.json`:

- **app**: App name, tagline, description
- **nav**: Navigation items (home, browse, upload, etc.)
- **auth**: Authentication (login, signup, logout)
- **video**: Video-related terms (title, description, views, etc.)
- **upload**: Video upload interface
- **dashboard**: Creator dashboard
- **admin**: Admin panel
- **categories**: Video categories
- **filters**: Sort and filter options
- **comments**: Comment system
- **notifications**: Notification messages
- **search**: Search interface
- **profile**: User profile
- **settings**: App settings
- **playlists**: Playlist management
- **share**: Sharing functionality
- **errors**: Error messages
- **common**: Common UI elements (save, cancel, loading, etc.)
- **footer**: Footer links and info

## Adding New Languages

1. Create a new directory under `locales/` (e.g., `locales/es/`)
2. Copy `en/common.json` to the new directory
3. Translate all values (keep keys in English)
4. Update `client/src/i18n.js` to import the new translations:

```javascript
import esCommon from './locales/es/common.json';

const resources = {
  en: { common: enCommon },
  es: { common: esCommon }
};
```

5. Add the new language to the LanguageSwitcher component

## Best Practices

1. Always use translation keys, never hardcode text
2. Keep keys descriptive and organized by feature
3. Use interpolation for dynamic content
4. Provide fallback text for missing translations
5. Test with different languages during development

## Current Status

- ✅ English (en) - Complete
- ⏳ Spanish (es) - Planned
- ⏳ French (fr) - Planned
- ⏳ German (de) - Planned
