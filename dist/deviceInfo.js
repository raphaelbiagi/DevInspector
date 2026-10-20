import { Platform } from 'react-native';
/**
 * Versão do SDK reportada no handshake. Mantida em um único lugar — antes havia
 * dois literais '1.0.0' que divergiam do package.json sem ninguém perceber.
 */
export const SDK_VERSION = '1.0.0';
function normalizePlatform() {
    switch (Platform.OS) {
        case 'ios':
            return 'ios';
        case 'android':
            return 'android';
        case 'web':
            return 'web';
        default:
            return 'unknown';
    }
}
/**
 * Lê metadados do app via expo-constants quando disponível. É `require` dinâmico
 * porque o SDK não depende do Expo — em bare React Native isso simplesmente falha
 * e caímos nos valores padrão.
 */
function readExpoConstants() {
    try {
        const Constants = require('expo-constants').default;
        return Constants ?? null;
    }
    catch {
        return null;
    }
}
export function getDeviceDetails() {
    const constants = readExpoConstants();
    const expoConfig = constants?.expoConfig ?? constants?.manifest ?? null;
    const rnVersion = Platform.constants?.reactNativeVersion;
    const reactNativeVersion = rnVersion
        ? `${rnVersion.major}.${rnVersion.minor}.${rnVersion.patch}${rnVersion.prerelease ? `-${rnVersion.prerelease}` : ''}`
        : 'unknown';
    // Platform.constants difere entre plataformas: iOS expõe osVersion,
    // Android expõe Release dentro de constants.
    const platformConstants = Platform.constants;
    const osVersion = (typeof Platform.Version === 'string' || typeof Platform.Version === 'number'
        ? String(Platform.Version)
        : undefined) ??
        platformConstants?.Release ??
        platformConstants?.osVersion ??
        'unknown';
    const deviceName = constants?.deviceName ??
        platformConstants?.Model ??
        platformConstants?.Brand ??
        `${normalizePlatform()} device`;
    const packageName = readPackageName(constants, expoConfig);
    return {
        appName: expoConfig?.name ?? 'React Native App',
        appVersion: expoConfig?.version ?? 'unknown',
        platform: normalizePlatform(),
        osVersion,
        deviceName,
        reactNativeVersion,
        ...(packageName ? { packageName } : {})
    };
}
/**
 * Identificador do processo nativo, usado pelo desktop para filtrar o logcat.
 * No Expo Go o processo é o próprio Expo Go, não o `android.package` do app.json.
 * Em bare React Native sem expo-constants não há fonte em JS — o desktop deixa
 * o usuário escolher o pacote manualmente.
 */
function readPackageName(constants, expoConfig) {
    if (constants?.executionEnvironment === 'storeClient') {
        return Platform.OS === 'android' ? 'host.exp.exponent' : 'host.exp.Exponent';
    }
    if (Platform.OS === 'android')
        return expoConfig?.android?.package;
    if (Platform.OS === 'ios')
        return expoConfig?.ios?.bundleIdentifier;
    return undefined;
}
//# sourceMappingURL=deviceInfo.js.map