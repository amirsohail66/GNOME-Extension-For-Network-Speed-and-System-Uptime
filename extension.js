const { St, Clutter, Gio, GLib, GObject } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;

let uptimePingIndicator;
const UptimePingIndicator = GObject.registerClass(
class UptimePingIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, "Uptime, Network Speed, CPU Load, and RAM Usage Indicator", false);
        this.label = new St.Label({
            text: "Loading...",
            y_align: Clutter.ActorAlign.CENTER
        });
        this.add_child(this.label);
        this._lastRxBytes = 0;
        this._lastTxBytes = 0;
        this._lastUpdateTime = 0;
        this._lastCpuStat = this._getCpuStat();
        this._defaultInterface = this._getDefaultInterface();
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, this._update.bind(this));
    }
    
    _update() {
        let uptime = this._getUptime();
        let networkSpeed = this._getNetworkSpeed();
        let cpuLoad = this._getCpuLoad();
        let memoryUsage = this._getMemoryUsage();
        this.label.set_text(`${uptime} | ${networkSpeed} | CPU: ${cpuLoad} | RAM: ${memoryUsage}`);
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
        try {
            let file = Gio.File.new_for_path('/proc/net/route');
            let [success, contents, etag] = file.load_contents(null);
            if (!success) {
                log("Failed to read /proc/net/route");
                return null;
            }
            let lines = contents.toString().split('\n');
            for (let line of lines) {
                let fields = line.trim().split(/\s+/);
                if (fields.length > 1 && fields[1] === '00000000') { // Check for the default route
                    let interfaceName = fields[0];
                    log(`Dynamically detected interface: ${interfaceName}`);
                    return interfaceName;
                }
            }
            log("No default route found in /proc/net/route");
            return null;
        } catch (e) {
            log(`Exception getting default interface: ${e}`);
            return null;
        }
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

    _getCpuStat() {
        try {
            let file = Gio.File.new_for_path('/proc/stat');
            let [success, contents, etag] = file.load_contents(null);
            if (!success) {
                log("Failed to read /proc/stat");
                return null;
            }
            let lines = contents.toString().split('\n');
            let cpuLine = lines.find(line => line.startsWith('cpu '));
            if (!cpuLine) {
                log("CPU data not found in /proc/stat");
                return null;
            }
            let data = cpuLine.trim().split(/\s+/).slice(1).map(x => parseInt(x));
            let total = data.reduce((a, b) => a + b, 0);
            let idle = data[3]; // idle is the 4th value
            return { total, idle };
        } catch (e) {
            log(`Exception in _getCpuStat: ${e}`);
            log(`Stack trace: ${e.stack}`);
            return null;
        }
    }

    _getCpuLoad() {
        let currentStat = this._getCpuStat();
        if (!currentStat || !this._lastCpuStat) {
            return "CPU Load N/A";
        }
        let totalDiff = currentStat.total - this._lastCpuStat.total;
        let idleDiff = currentStat.idle - this._lastCpuStat.idle;
        let cpuUsage = (1 - idleDiff / totalDiff) * 100;
        this._lastCpuStat = currentStat;
        return `${cpuUsage.toFixed(2)}%`;
    }

    _getMemoryUsage() {
        try {
            let file = Gio.File.new_for_path('/proc/meminfo');
            let [success, contents, etag] = file.load_contents(null);
            if (!success) {
                log("Failed to read /proc/meminfo");
                return "RAM N/A";
            }
            let lines = contents.toString().split('\n');
            let memTotalLine = lines.find(line => line.startsWith('MemTotal:'));
            let memAvailableLine = lines.find(line => line.startsWith('MemAvailable:'));
            if (!memTotalLine || !memAvailableLine) {
                log("Memory data not found in /proc/meminfo");
                return "RAM N/A";
            }
            let memTotal = parseInt(memTotalLine.split(/\s+/)[1]);
            let memAvailable = parseInt(memAvailableLine.split(/\s+/)[1]);
            let memUsed = memTotal - memAvailable;
            let memUsage = (memUsed / memTotal) * 100;
            return `${memUsage.toFixed(2)}%`;
        } catch (e) {
            log(`Exception in _getMemoryUsage: ${e}`);
            log(`Stack trace: ${e.stack}`);
            return "RAM Error";
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
