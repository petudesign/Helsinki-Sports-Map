import { type CSSProperties, useState } from 'react'
import { RiCheckLine, RiMapPin2Line } from '@remixicon/react'
import type { LipasVenue, SportFeature, SportsVenue } from '../data/types'
import type { TrendingSignal } from '../data/trending'
import { featureDisplayName, isGenericSite, priceLabelKey, serviceMapSearchUrl, venueActivityLabel } from '../format'
import { type Locale, text } from '../i18n'

function OpeningHours({ raw, label }: { raw: string; label: string }) {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return null
  const parsed = lines.map((line) => {
    const match = line.match(/^([A-Za-zÅÄÖåäö.,\s-–]+?)\s+(\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2})(?:\s+(.*))?$/)
    if (!match) return { raw: line }
    const days = match[1].trim().replace(/\s*-\s*/g, '–')
    const time = match[2].trim().replace(/\s*-\s*/g, '–')
    const rawNote = match[3]?.trim() || ''
    const firstChar = Array.from(rawNote)[0]
    const note = firstChar ? `${firstChar.toLocaleUpperCase()}${rawNote.slice(firstChar.length)}` : ''
    return { days, time, note }
  })
  const structured = parsed.filter((item): item is { days: string; time: string; note: string } => 'days' in item)
  const notes = new Set(structured.map((item) => item.note).filter(Boolean))
  const sharedNote = structured.length > 1 && notes.size === 1 && structured.every((item) => item.note) ? [...notes][0] : undefined

  return <div className="facility-hours">
    <h3 className="facility-hours-title">{label}</h3>
    <ul className="facility-hours-list">
      {parsed.map((item, index) => 'days' in item ? (
        <li key={`${item.days}-${index}`} className="facility-hours-row">
          <span className="facility-hours-days">{item.days}</span>
          <strong className="facility-hours-time">{item.time}</strong>
          {item.note && !sharedNote && <small className="facility-hours-note">{item.note}</small>}
        </li>
      ) : (
        <li key={`raw-${index}`} className="facility-hours-plain">{item.raw}</li>
      ))}
    </ul>
    {sharedNote && <p className="facility-hours-shared-note">{sharedNote}</p>}
  </div>
}

function FacilityBreakdown({ facilities, locale }: { facilities: NonNullable<LipasVenue['facilities']>; locale: Locale }) {
  if (facilities.length < 2) return null
  return <details className="disclosure facility-breakdown"><summary>{text(locale, 'facilityComponents', { count: String(facilities.length) })}</summary><ul>{facilities.map((facility) => {
    const sourceName = facility.name.split(' / ').slice(-1)[0] || facility.name
    const type = locale === 'en' ? facility.typeNameEn ?? facility.typeName : facility.typeName
    const name = locale === 'en' && sourceName.toLocaleLowerCase('fi-FI') === facility.typeName?.toLocaleLowerCase('fi-FI') ? type ?? sourceName : sourceName
    return <li key={facility.id}><strong>{name}</strong>{type && type.toLocaleLowerCase(locale) !== name.toLocaleLowerCase(locale) && <span>{type}</span>}{facility.address && <small>{facility.address}</small>}</li>
  })}</ul></details>
}

export function FacilityDetails({ feature, venue, trend, trendingEnabled, locale, directionsOpen, onDirections }: {
  feature: SportFeature
  venue?: SportsVenue
  trend?: TrendingSignal
  trendingEnabled: boolean
  locale: Locale
  directionsOpen: boolean
  onDirections: () => void
}) {
  const serviceMap = venue?.serviceMap
  const [photoFailed, setPhotoFailed] = useState(false)
  const photoCaption = locale === 'en' ? serviceMap?.pictureCaptionEn ?? serviceMap?.pictureCaptionFi : serviceMap?.pictureCaptionFi ?? serviceMap?.pictureCaptionEn
  const hasFacilityBreakdown = (venue?.lipas?.facilities?.length ?? 0) > 1
  const officialShortDescription = locale === 'en' ? serviceMap?.shortDescriptionEn : serviceMap?.shortDescriptionFi || serviceMap?.shortDescriptionEn
  const officialDescription = locale === 'en' ? serviceMap?.descriptionEn : serviceMap?.descriptionFi || serviceMap?.descriptionEn
  const officialOpeningHours = locale === 'en' ? serviceMap?.openingHoursEn : serviceMap?.openingHoursFi || serviceMap?.openingHoursEn
  const officialPrice = locale === 'en' ? serviceMap?.priceEn : serviceMap?.priceFi || serviceMap?.priceEn
  const officialServices = locale === 'en'
    ? serviceMap?.servicesEn ?? []
    : serviceMap?.servicesFi.length ? serviceMap.servicesFi : serviceMap?.servicesEn ?? []
  const displayName = featureDisplayName(feature, locale, venue?.name)
  const ownPage = [venue?.officialUrl, serviceMap?.sourceUrl].find((url) => url && !isGenericSite(url))
  const officialHref = ownPage ?? serviceMapSearchUrl(locale, displayName)
  const officialLabel = ownPage ? text(locale, 'openOfficial') : (locale === 'fi' ? 'Etsi Helsingin palvelukartalta' : 'Find on Helsinki Service Map')
  const accessLink = venue?.lipas?.accessSourceUrl && !isGenericSite(venue.lipas.accessSourceUrl) && venue.lipas.accessSourceUrl !== officialHref ? venue.lipas.accessSourceUrl : undefined
  const hasOfficialDetails = Boolean(officialShortDescription?.trim() || officialDescription?.trim() || officialServices.length || officialPrice?.trim() || serviceMap?.links.length)
  return <div className="facility-card">
    {venue?.lipas?.parentName && <span className="facility-parent-name">{venue.lipas.parentName}</span>}
    {serviceMap?.pictureUrl && !photoFailed && <figure className="facility-photo"><img onLoad={(event) => { event.currentTarget.dataset.loaded = 'true' }} src={serviceMap.pictureUrl} alt={photoCaption ?? featureDisplayName(feature, locale, venue?.name)} loading="eager" fetchPriority="high" decoding="async" onError={() => setPhotoFailed(true)} />{serviceMap.sourceUrl && <figcaption><a href={serviceMap.sourceUrl} target="_blank" rel="noreferrer">{locale === 'fi' ? 'Helsingin palvelukartta' : 'Helsinki Service Map'} ↗</a></figcaption>}</figure>}
    {trend && trendingEnabled && <section className={`trend-summary trend-${trend.stage}`}><div><span>{text(locale, trend.source === 'preview' ? 'previewScore' : 'interestSignal')}</span><strong>{trend.interestScore}</strong></div><div className="trend-summary-bar"><span style={{ '--trend-progress': trend.interestScore / 100 } as CSSProperties} /></div><small>+{trend.recentChange}% · {text(locale, trend.stage === 'new' ? 'newOnList' : trend.stage === 'rising' ? 'risingInterest' : 'popularNow')}</small></section>}
    <div className="facility-location-row">
      {venue?.lipas?.address && <div className="facility-address">
        <span className="facility-address-icon" aria-hidden="true"><RiMapPin2Line size={15} /></span>
        <span className="facility-address-copy">
          <span className="facility-address-label">{locale === 'fi' ? 'Osoite' : 'Address'}</span>
          <strong>{venue.lipas.address}</strong>
        </span>
      </div>}
      <button className={directionsOpen ? 'btn btn-sm directions-open is-open' : 'btn btn-primary directions-open'} type="button" aria-pressed={directionsOpen} onClick={onDirections}>{directionsOpen && <RiCheckLine aria-hidden="true" size={14} />}{directionsOpen ? (locale === 'fi' ? 'Reittihaku auki' : 'Directions open') : (locale === 'fi' ? 'Reittiohjeet' : 'Directions')}</button>
    </div>
    {(() => {
      // Show only facts the source actually has, and say once what is missing.
      const priceClass = venue?.lipas?.priceClass ?? feature.priceClass
      const accessStatus = venue?.lipas?.accessStatus
      const priceKnown = Boolean(priceClass && priceClass !== 'unknown')
      const hoursKnown = Boolean(officialOpeningHours?.trim())
      const facts = [
        priceKnown ? { label: text(locale, 'priceFilter'), value: text(locale, priceLabelKey(priceClass)) } : undefined,
        accessStatus && accessStatus !== 'unknown' ? { label: text(locale, 'access'), value: text(locale, accessStatus === 'open' ? 'accessOpen' : accessStatus === 'restricted' ? 'accessRestricted' : 'accessBooking') } : undefined,
      ].filter((fact): fact is { label: string; value: string } => Boolean(fact))
      const missingKey = !priceKnown && !hoursKnown ? 'missingPriceAndHours' : !hoursKnown ? 'missingHours' : !priceKnown ? 'missingPrice' : undefined
      return <div className="facility-info-block">
        {facts.length > 0 && <dl className="facility-facts">{facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
        {hoursKnown && <OpeningHours raw={officialOpeningHours!.trim()} label={text(locale, 'openingHours')} />}
        {missingKey && <p className="facility-unknown">{text(locale, missingKey)}</p>}
        <a className="text-link facility-official-link" href={officialHref} target="_blank" rel="noreferrer">{officialLabel} ↗</a>
      </div>
    })()}
    {!venue?.lipas?.accessNoteFi && accessLink && <p className="facility-access-link"><a href={accessLink} target="_blank" rel="noreferrer">{text(locale, 'verifyAccess')} ↗</a></p>}
    {venue?.lipas?.accessNoteFi && <div className="facility-access"><h3 className="section-title">{text(locale, 'access')}</h3><p>{locale === 'en' ? venue.lipas.accessNoteEn : venue.lipas.accessNoteFi}</p>{accessLink && <a href={accessLink} target="_blank" rel="noreferrer">{text(locale, 'verifyAccess')} ↗</a>}</div>}
    <div className="facility-section">
      <h3 className="section-title">{text(locale, 'activities')}</h3>
      {venue?.sports.length ? <ul className="facility-activities">{venue.sports.map((sport) => <li key={sport}>{venueActivityLabel(locale, sport)}</li>)}</ul> : <p className="facility-muted-note">{text(locale, 'missingSports')}</p>}
    </div>
    {venue && (hasFacilityBreakdown || (serviceMap && hasOfficialDetails)) && <div className="facility-more-info">
      <FacilityBreakdown facilities={venue.lipas?.facilities ?? []} locale={locale} />
      {serviceMap && hasOfficialDetails && <details className="disclosure official-details">
        <summary>{text(locale, 'officialInfo')}</summary>
        {officialShortDescription && <p>{officialShortDescription}</p>}
        {officialDescription && <p>{officialDescription}</p>}
        {officialServices.length > 0 && <><h3 className="section-title">{text(locale, 'officialServices')}</h3><ul className="official-services">{officialServices.map((service) => <li key={service}>{service}</li>)}</ul></>}
        {officialPrice && <><h3 className="section-title">{text(locale, 'priceDetails')}</h3>{serviceMap.priceGroups.length > 0 ? <div className="price-groups">{serviceMap.priceGroups.map((group) => <section key={group.heading}><strong>{group.heading}</strong><ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul></section>)}</div> : <p className="official-hours">{officialPrice}</p>}</>}
        {serviceMap.links.length > 0 && <><h3 className="section-title">{text(locale, 'officialLinks')}</h3><ul className="official-links">{serviceMap.links.map((link) => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer">{locale === 'en' ? link.labelEn : link.labelFi} ↗</a></li>)}</ul></>}
      </details>}
    </div>}
  </div>
}
