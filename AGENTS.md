## Windows / PowerShell / npm

Cuando trabajes en Windows PowerShell, usa `npm.cmd` en vez de `npm` para evitar que PowerShell intente ejecutar `npm.ps1` y falle por `ExecutionPolicy`.

Comandos correctos:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd -v
```

No uses estos comandos directamente en PowerShell:

```powershell
npm run lint
npm test
npm run build
npm -v
```

Alternativas aceptables:

```powershell
cmd /c npm run build
& "$env:ProgramFiles\nodejs\npm.cmd" run build
```

Motivo:
PowerShell puede resolver `npm` como `C:\Program Files\nodejs\npm.ps1`. Si la política de ejecución bloquea scripts `.ps1`, el comando falla antes de iniciar npm, Next.js o cualquier script del proyecto.
