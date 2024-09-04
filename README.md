# GNOME Extension for Network Speed and System Uptime

This GNOME extension displays the system uptime and network speed (inbound and outbound) in the top bar. It's useful for monitoring system uptime and real-time network speed directly from the GNOME shell.

## Features

* **System Uptime**: Displays how long the system has been running.
* **Network Speed**: Shows inbound and outbound network speed in KB/s or MB/s.

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/amirsohail66/GNOME-Extension-For-Network-Speed-and-System-Uptime.git
   cd GNOME-Extension-For-Network-Speed-and-System-Uptime
   ```

2. **Copy the extension folder** to the GNOME Shell extensions directory:
   ```bash
   cp -r uptime-ping@custom ~/.local/share/gnome-shell/extensions/
   ```

3. **Restart GNOME Shell**:
   * Press `Alt + F2`, type `r`, and press `Enter`.

4. **Enable the extension**:
   * Use GNOME Tweaks or run the following command:
     ```bash
     gnome-extensions enable uptime-ping@custom
     ```

## Usage

* Once enabled, you will see the uptime and network speed displayed in the top bar of your GNOME Shell.
* The indicator will update every 2 seconds.

## Files

* **extension.js**: Main JavaScript file for the extension.
* **metadata.json**: Metadata about the extension.
* **stylesheet.css**: CSS file for styling the indicator in the top bar.

## Compatibility

* Tested with GNOME Shell versions: `3.38`, `40`, `41`, `42`, `43`.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Insert your chosen license here]

## Support

If you encounter any problems or have any suggestions, please open an issue on the GitHub repository.