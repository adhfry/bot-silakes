import { db } from "./firebase.mjs";
import dotenv from "dotenv";
dotenv.config();
let rtdbListener = null;

export function startListeningRTDB() {
  const ref = db.ref("test-node");

  // hindari listener ganda
  if (rtdbListener) {
    ref.off("value", rtdbListener);
  }

  rtdbListener = (snapshot) => {
    const data = snapshot.val();
    console.log("✅ Data berhasil dibaca dari RTDB:", data);
  };

  ref.on("value", rtdbListener);
}

export const sendTestDataNew = async () => {
  let refVar =
    process.env.APP_ENV !== "local" ? "notifikasi" : "notifikasi_dev";
  const ref = db.ref(refVar);
  await ref.push({
    to: "6281233107475",
    message: "Halo Admin, ada hasil baru masuk!\nini pesan tes",
    timestamp: Date.now(),
  });
};

export async function testWriteToRTDB() {
  const ref = db.ref("test-node");
  await ref.set({
    timestamp: Date.now(),
    message: "Halo dari Firebase RTDB",
  });
  console.log("✅ Data berhasil ditulis ke RTDB");
}
export async function testReadFromRTDB() {
  const ref = db.ref("test-node");
  const snapshot = await ref.once("value");
  const data = snapshot.val();
  console.log("✅ Data berhasil dibaca dari RTDB:", data);
}
export async function testUpdateToRTDB() {
  const ref = db.ref("test-node");
  await ref.update({
    message: "Pesan telah diperbarui",
  });
  const snapshot = await ref.once("value");
  const dataUpdate = snapshot.val();
  console.log("✅ Data berhasil diperbarui di RTDB", dataUpdate);
}
export async function testDeleteFromRTDB() {
  const ref = db.ref("test-node");
  await ref.remove();
  console.log("✅ Data berhasil dihapus dari RTDB");
}
export async function testReadFromRTDBWithCallback() {
  const ref = db.ref("test-node");
  ref.on("value", (snapshot) => {
    const data = snapshot.val();
    console.log("✅ Data berhasil dibaca dari RTDB:", data);
  });
}
