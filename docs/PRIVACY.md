# Helsinki Sports Map — privacy principles

This project follows data minimisation by default. The map is usable without creating an account and without giving the app a name, email address, or other identity information.

## What the app stores

- The app does not store search terms, typed addresses, route requests, current location, coordinates, or browsing history in cookies.
- The only current cookie is a first-party `hsm_privacy` preference cookie that remembers whether the user selected optional analytics or only necessary functionality. It contains no address, location, identifier, or route data.
- Current location is kept only in in-memory session state while the user is using the route feature. Reloading the page clears it.

## When location is used

Location permission is requested only after the user presses the current-location button. If permission is granted, the coordinates are used to fill the starting point and calculate the requested route. The coordinates may be sent to the selected geocoding and routing providers because that is required to provide the address or route. The app itself does not retain them after the session.

The location feature must never be activated automatically on page load, and location data must never be added to analytics events or cookies.

## Analytics

Analytics is optional and opt-in. It is intended only to understand aggregate interaction patterns and improve usability, for example whether people can find facilities, understand filters, and complete route searches.

Analytics must not be used to identify, profile, or sell information about users. It must not collect typed addresses, coordinates, route geometries, search history, facility-level personal behaviour, or other data that could reasonably identify a person. No analytics provider or analytics event is active until a future implementation explicitly defines the event list, retention, provider, and consent check.

## Product rule

Any new feature that could process user data must document:

1. what data is needed and why,
2. whether processing is local or sent to an external provider,
3. how long it is kept,
4. whether consent is required, and
5. how the user can use the core map without it.

If the feature does not need the data, do not collect it.
