// src/preload/index.js
// Preload script — runs before renderer
// Phase 3: expose Supabase/IPC APIs here if needed
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
})

contextBridge.exposeInMainWorld('telnyxConfig', {
  sipUsername: 'useradmin88650',
  sipPassword: '^H8h_jwBh+Hf',
})
