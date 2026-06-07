import { create } from 'zustand'

export const useStore = create((set) => ({
  // L1
  l1Report: null,
  l1Loading: false,
  l1Progress: 0,
  l1Stage: '',
  setL1Report: (r) => set({ l1Report: r }),
  setL1Loading: (v) => set({ l1Loading: v }),
  setL1Progress: (p, s) => set({ l1Progress: p, l1Stage: s }),

  // L2
  l2Report: null,
  l2Loading: false,
  setL2Report: (r) => set({ l2Report: r }),
  setL2Loading: (v) => set({ l2Loading: v }),

  // L3
  l3RunId: null,
  l3Status: null,
  l3Loading: false,
  setL3RunId: (id) => set({ l3RunId: id }),
  setL3Status: (s) => set({ l3Status: s }),
  setL3Loading: (v) => set({ l3Loading: v }),
}))
