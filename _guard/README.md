# Repository-Local Project Guard

These guard files belong only to this repository.

```text
GUARD_IS_REPOSITORY_LOCAL=YES
CROSS_PROJECT_GUARD_EDIT=FORBIDDEN
SHARED_PROJECT_GUARD_EDIT=FORBIDDEN
```

Codex must not edit `D:\CODE\PROJECT_GUARD.bat`.

Codex must not edit guard files in sibling repositories. Changes to another repository's guard require working in that repository and committing there.

Run status:

```powershell
.\GUARD.bat status
```

Run doctor:

```powershell
.\GUARD.bat doctor
```

Project config lives in:

```text
_guard\PROJECT_GUARD.config.bat
```

Project-specific checks live in:

```text
_guard\PROJECT_STATUS_HOOK.bat
```

The generic engine lives in:

```text
_guard\PROJECT_GUARD_ENGINE.bat
```

Encoding requirement for `.bat` files:

```text
UTF-8 without BOM
CRLF
first bytes: 40-65-63-68-6F-20-6F-66
```
