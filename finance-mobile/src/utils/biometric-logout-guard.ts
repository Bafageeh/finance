let manualLogoutSkipBiometric = false;

export async function markManualLogoutForBiometrics() {
  manualLogoutSkipBiometric = true;
}

export async function clearManualLogoutForBiometrics() {
  manualLogoutSkipBiometric = false;
}

export async function shouldSkipBiometricAfterLogout() {
  return manualLogoutSkipBiometric;
}
