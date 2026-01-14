const os = require('os');

function printHello() {
  const asciiArt = `
  _    _      _ _         __          __        _     _ 
 | |  | |    | | |        \\ \\        / /       | |   | |
 | |__| | ___| | | ___     \\ \\  /\\  / /__  _ __| | __| |
 |  __  |/ _ \ | |/ _ \\     \\ \\/  \\/ / _ \\| '__| |/ _\` |
 | |  | |  __/ | | (_) |     \\  /\\  / (_) | |  | | (_| |
 |_|  |_|\\___|_|_|\\___/       \\/  \\/ \\___/|_|  |_|\\__,_|
    `;

  console.log(asciiArt);
  console.log("-".repeat(50));
  console.log(`OS Platform:  ${os.platform()}`);
  console.log(`OS Release:   ${os.release()}`);
  console.log(`Architecture: ${os.arch()}`);
  console.log(`CPU Cores:    ${os.cpus().length}`);
  console.log(`Node Version: ${process.version}`);
  console.log("-".repeat(50));
}

printHello();