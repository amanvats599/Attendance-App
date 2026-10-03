const { createRunOncePlugin, withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

const META_NAME = 'EXDevMenuShowFloatingActionButton';

function withHideDevMenuButton(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults[META_NAME] = false;
    return config;
  });

  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) {
      return config;
    }
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }
    const existing = application['meta-data'].find((item) => item.$['android:name'] === META_NAME);
    if (existing) {
      existing.$['android:value'] = 'false';
    } else {
      application['meta-data'].push({
        $: {
          'android:name': META_NAME,
          'android:value': 'false',
        },
      });
    }
    return config;
  });

  return config;
}

module.exports = createRunOncePlugin(withHideDevMenuButton, 'hide-dev-menu-button');
