/** @param {NS} ns **/
export async function main(ns) {
    const sharePower = ns.getSharePower();
    ns.toast(`share power ${sharePower}`, "info", 5000);
}
