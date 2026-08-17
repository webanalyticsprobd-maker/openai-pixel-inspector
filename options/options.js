import { getSettings, saveSettings } from '../utils/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const customEventValidationInput = document.getElementById('customEventValidation');
  const networkInterceptionInput = document.getElementById('networkInterception');
  const debugLoggingInput = document.getElementById('debugLogging');
  const btnSave = document.getElementById('btn-save');
  const saveStatus = document.getElementById('save-status');

  const settings = await getSettings();
  customEventValidationInput.checked = settings.customEventValidation !== false;
  networkInterceptionInput.checked = settings.networkInterception !== false;
  debugLoggingInput.checked = Boolean(settings.debugLogging);

  btnSave.addEventListener('click', async () => {
    const newSettings = {
      customEventValidation: customEventValidationInput.checked,
      networkInterception: networkInterceptionInput.checked,
      debugLogging: debugLoggingInput.checked
    };
    await saveSettings(newSettings);
    saveStatus.textContent = 'Settings saved successfully!';
    setTimeout(() => { saveStatus.textContent = ''; }, 2500);
  });
});
