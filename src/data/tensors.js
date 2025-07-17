export function strikeDipRakeToMomentTensor(strike, dip, rake, magnitudeMw) {
  const deg2rad = (deg) => (deg * Math.PI) / 180;

  strike = deg2rad(strike);
  dip = deg2rad(dip);
  rake = deg2rad(rake);

  const cos = Math.cos;
  const sin = Math.sin;

  const M0 = Math.pow(10, 1.5 * magnitudeMw + 9.1); // Seismic moment in Nm

  const Mrr =
    -M0 *
    (sin(dip) * cos(rake) * sin(2 * strike) +
      sin(2 * dip) * sin(rake) * sin(strike) * sin(strike));
  const Mtt =
    M0 *
    (sin(dip) * cos(rake) * sin(2 * strike) -
      sin(2 * dip) * sin(rake) * cos(strike) * cos(strike));
  const Mpp = M0 * sin(2 * dip) * sin(rake);
  const Mrp =
    -M0 *
    (cos(dip) * cos(rake) * cos(strike) +
      cos(2 * dip) * sin(rake) * sin(strike));
  const Mtp =
    -M0 *
    (cos(dip) * cos(rake) * sin(strike) -
      cos(2 * dip) * sin(rake) * cos(strike));
  const Mrt =
    -M0 *
    (sin(dip) * cos(rake) * cos(2 * strike) +
      0.5 * sin(2 * dip) * sin(rake) * sin(2 * strike));

  return { Mrr, Mtt, Mpp, Mrp, Mtp, Mrt };
}
