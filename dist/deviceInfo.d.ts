/**
 * Versão do SDK reportada no handshake. Mantida em um único lugar — antes havia
 * dois literais '1.0.0' que divergiam do package.json sem ninguém perceber.
 */
export declare const SDK_VERSION = "1.0.0";
export interface DeviceDetails {
    appName: string;
    appVersion: string;
    platform: 'ios' | 'android' | 'web' | 'unknown';
    osVersion: string;
    deviceName: string;
    reactNativeVersion: string;
}
export declare function getDeviceDetails(): DeviceDetails;
