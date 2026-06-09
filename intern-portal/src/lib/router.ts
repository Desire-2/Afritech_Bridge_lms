/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';

export interface RouteState {
  path: string;
  params: Record<string, string>;
}

// Parse current URL hash into path and parameters
export function parseHash(): RouteState {
  const hash = window.location.hash;
  if (!hash || hash === '#') {
    return { path: '/intern', params: {} };
  }

  // Split path from query params if any
  const normalizedHash = hash.replace(/^#/, ''); // remove leading #
  const [pathWithParams, queryString] = normalizedHash.split('?');
  
  const segments = pathWithParams.split('/').filter(Boolean);
  const path = '/' + segments.join('/');

  const params: Record<string, string> = {};

  // Parse path parameters manually, e.g. /intern/tasks/task-1
  if (segments[0] === 'intern' && segments[1] === 'tasks' && segments[2]) {
    params.assignment_id = segments[2];
  }

  // Parse standard query params
  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  }

  return { path, params };
}

export function useRouter() {
  const [routeState, setRouteState] = useState<RouteState>(parseHash());

  useEffect(() => {
    const handleHashChange = () => {
      setRouteState(parseHash());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const navigate = (path: string, queryParams?: Record<string, string>) => {
    let target = path;
    if (queryParams) {
      const q = new URLSearchParams(queryParams);
      target += `?${q.toString()}`;
    }
    window.location.hash = target.startsWith('/') ? target : `/${target}`;
  };

  return {
    path: routeState.path,
    params: routeState.params,
    navigate
  };
}
