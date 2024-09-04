const { St, Clutter, Gio, GLib, GObject } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;

let uptimePingIndicator;
const UptimePingIndicator = GObject.registerClass(
class UptimePingIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, "Uptime and Network Speed Indicator", false);
        this.label = new St.Label({
            text: "Loading...",
            y_align: Clutter.ActorAlign.CENTER
        });
        this.add_child(this.label);
        this._lastRxBytes = 0;
        this._lastTxBytes = 0;
        this._lastUpdateTime = 0;
        this._defaultInterface = this._getDefaultInterface();
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, this._update.bind(this));
    }
    _update() {
        let uptime = this._getUptime();
        let networkSpeed = this._getNetworkSpeed();
        this.label.set_text(`${uptime} | ${networkSpeed}`);
        return true; // Returning true keeps the timeout active
    }
    _getUptime() {
        try {
            let [result, stdout, stderr, exit_code] = GLib.spawn_command_line_sync("uptime -p");
            if (exit_code === 0) {
                return stdout.toString().trim();
            } else {
                log(`Error getting uptime: ${stderr.toString()}`);
                return "Uptime N/A";
            }
        } catch (e) {
            log(`Exception getting uptime: ${e}`);
            return "Uptime Error";
        }
    }
    _getDefaultInterface() {
        this._defaultInterface = "wlp0s20f3"; // Directly set the interface
        log(`Using hardcoded interface: ${this._defaultInterface}`);
        return this._defaultInterface;
    }
    _getNetworkSpeed() {
        try {
            if (!this._defaultInterface) {
                log("No active interface found");
                return "No active interface";
            }
            let file = Gio.File.new_for_path('/proc/net/dev');
            let [success, contents, etag] = file.load_contents(null);
            if (!success) {
                log("Failed to read /proc/net/dev");
                return "Failed to read network data";
            }
            let lines = contents.toString().split('\n');
            let interfaceData = lines.find(line => line.includes(this._defaultInterface));
            if (!interfaceData) {
                log(`Interface ${this._defaultInterface} not found in /proc/net/dev`);
                return "Interface data not found";
            }
            let data = interfaceData.trim().split(/\s+/);
            let rxBytes = parseInt(data[1]);
            let txBytes = parseInt(data[9]);
            let currentTime = GLib.get_monotonic_time();
            let timeDelta = (currentTime - this._lastUpdateTime) / 1000000; // Convert to seconds
            if (this._lastUpdateTime !== 0) {
                let rxSpeed = (rxBytes - this._lastRxBytes) / timeDelta / 1024; // Convert to KB/s
                let txSpeed = (txBytes - this._lastTxBytes) / timeDelta / 1024; // Convert to KB/s
                this._lastRxBytes = rxBytes;
                this._lastTxBytes = txBytes;
                this._lastUpdateTime = currentTime;
                // Convert to MB/s if the speed exceeds 1024 KB/s
                let rxSpeedDisplay = rxSpeed > 1024 ? `${(rxSpeed / 1024).toFixed(2)} MB/s` : `${rxSpeed.toFixed(2)} KB/s`;
                let txSpeedDisplay = txSpeed > 1024 ? `${(txSpeed / 1024).toFixed(2)} MB/s` : `${txSpeed.toFixed(2)} KB/s`;
                return `In: ${rxSpeedDisplay}, Out: ${txSpeedDisplay}`;
            } else {
                this._lastRxBytes = rxBytes;
                this._lastTxBytes = txBytes;
                this._lastUpdateTime = currentTime;
                return "Calculating...";
            }
        } catch (e) {
            log(`Exception in _getNetworkSpeed: ${e}`);
            log(`Stack trace: ${e.stack}`);
            return "Speed Error: " + e.message;
        }
    }
    destroy() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
        super.destroy();
    }
});
function init() {}
function enable() {
    uptimePingIndicator = new UptimePingIndicator();
    Main.panel.addToStatusArea('uptime-ping-indicator', uptimePingIndicator);
}
function disable() {
    if (uptimePingIndicator) {
        uptimePingIndicator.destroy();
        uptimePingIndicator = null;
    }
}
