'use client';

import { useEffect } from 'react';

/** Loads Bootstrap's JS (accordion, collapse, dropdown) only in the browser. */
export default function BootstrapJS() {
  useEffect(() => {
    import('bootstrap/dist/js/bootstrap.bundle.min.js');
  }, []);
  return null;
}