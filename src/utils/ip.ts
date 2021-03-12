// IP or IP-address utils

import ipAddress from 'ip-address';

export function parseIPAddress(ip: string): ipAddress.Address4 | ipAddress.Address6 | undefined {
  try {
    const ipv4 = new ipAddress.Address4(ip);
    if (ipv4.valid) {
      return ipv4;
    }
  } catch (_e) {}
  try {
    const ipv6 = new ipAddress.Address6(ip);
    if (ipv6.valid) {
      return ipv6;
    }
  } catch (_e) {}

  return undefined;
}

export const isValidIPAddress = (ip: string) => Boolean(parseIPAddress(ip));

function toCIDRPair(ipv4: string): [bigint, number] {
  try {
    const [a, b] = ipv4.split('/');
    const ip = new ipAddress.Address4(a);
    const range = parseInt(b, 10);
    return [ipv4PartsToBigInt(ip.parsedAddress), range];
  } catch (e) {
    throw e;
  }
}

// Ref: https://ipgeolocation.io/resources/bogon.html
const bogonSpace = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '255.255.255.255/32',
].map(toCIDRPair);

// Ref: https://en.wikipedia.org/wiki/List_of_assigned_/8_IPv4_address_blocks#List_of_assigned_/8_blocks_to_the_United_States_Department_of_Defense
const dodSpace = [
  // "6.0.0.0/8",
  // "7.0.0.0/8",
  '11.0.0.0/8', // actually, even 11/8 are being announced nowadays
  // "21.0.0.0/8",
  // "22.0.0.0/8",
  '26.0.0.0/8',
  // "28.0.0.0/8",
  // "29.0.0.0/8",
  // "30.0.0.0/8",
  // "33.0.0.0/8",
  // "55.0.0.0/8",
  // "214.0.0.0/8",
  // "215.0.0.0/8"
].map(toCIDRPair);

export function isInCIDR(ipv4: bigint, cidr: [bigint, number]): boolean {
  return (ipv4 ^ cidr[0]) >> BigInt(32 - cidr[1]) === BigInt(0);
}

export function ipv4PartsToBigInt(ipv4Parts: string[]): bigint {
  return ipv4Parts.reduce<bigint>((p: bigint, x: string) => (p << BigInt(8)) + BigInt(parseInt(x, 10)), BigInt(0));
}

export function isBogusIPAddress(ip: ipAddress.Address4 | ipAddress.Address6, dodAsBogus = false) {
  if (ip.v4) {
    // const bits = ip.bigInteger(); // jsbn's BigInteger has nothing to with ECMA-262 bigint
    const bits = ipv4PartsToBigInt((ip as ipAddress.Address4).parsedAddress);
    if (bogonSpace.map((bogon) => isInCIDR(bits, bogon)).some((v) => v)) {
      return true;
    }
    if (dodAsBogus && dodSpace.map((bogon) => isInCIDR(bits, bogon)).some((v) => v)) {
      if (new Date().getFullYear() <= 2021) {
        // We should block it forever.
        // TODO: LoL
        return true;
      }
    }
    return false;
  } else {
    // TODO: Unimplemented
    return false;
  }
}

export function simplyHostname(hostname: string): string {
  if (!isValidIPAddress(hostname)) {
    hostname = hostname.split('.')[0];
  }
  return hostname;
}
