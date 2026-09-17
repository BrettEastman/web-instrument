/**
 * BleHeartRate — consumer heart-rate straps and watches over Web Bluetooth.
 *
 * The BLE Heart Rate profile is a standard GATT service ('heart_rate'),
 * so any Polar/Garmin/Wahoo-style strap works with no custom firmware —
 * the browser shows a device picker, we subscribe to notifications.
 * Chromium-only; requires a user gesture to call start().
 */
import type { BpmListener, PulseSource } from './types';

export class BleHeartRate implements PulseSource {
	readonly label = 'bluetooth strap';

	private device: BluetoothDevice | null = null;
	private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
	private onNotify: ((e: Event) => void) | null = null;

	static available(): boolean {
		return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
	}

	async start(onBpm: BpmListener): Promise<void> {
		this.device = await navigator.bluetooth.requestDevice({
			filters: [{ services: ['heart_rate'] }]
		});
		const server = await this.device.gatt!.connect();
		const service = await server.getPrimaryService('heart_rate');
		this.characteristic = await service.getCharacteristic('heart_rate_measurement');

		this.onNotify = (e: Event) => {
			const value = (e.target as BluetoothRemoteGATTCharacteristic).value;
			if (value) onBpm(parseHeartRateMeasurement(value));
		};
		this.characteristic.addEventListener('characteristicvaluechanged', this.onNotify);
		await this.characteristic.startNotifications();
	}

	stop(): void {
		if (this.characteristic && this.onNotify) {
			this.characteristic.removeEventListener('characteristicvaluechanged', this.onNotify);
			this.characteristic.stopNotifications().catch(() => {});
		}
		this.device?.gatt?.disconnect();
		this.device = null;
		this.characteristic = null;
		this.onNotify = null;
	}
}

/**
 * Per the GATT Heart Rate Measurement spec: byte 0 is a flags field;
 * bit 0 says whether the value is uint8 (most straps) or uint16.
 */
function parseHeartRateMeasurement(dv: DataView): number {
	const flags = dv.getUint8(0);
	return flags & 0x01 ? dv.getUint16(1, /* littleEndian */ true) : dv.getUint8(1);
}
