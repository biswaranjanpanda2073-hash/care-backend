async function testRender() {
  try {
    const res = await fetch('https://care-backend-reke.onrender.com/api/tickets');
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Data:", data);
  } catch (e) {
    console.error("Fetch failed:", e.message);
  }
}
testRender();
