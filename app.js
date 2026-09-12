// ===================================================
// 우리 반 담벼락 - 시작점
//
// 메모를 쓰면 올린 순서대로 담벼락에 붙습니다.
// Firebase Firestore를 연동하여 새로고침해도 메모가 유지됩니다.
// ===================================================

// --- Firebase SDK 불러오기 (CDN ES Module) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// --- Firebase 설정 ---
const firebaseConfig = {
  apiKey: "AIzaSyAhUJosokzMuAHTJhltZrK5vEx-eN-nhls",
  authDomain: "test-class-well.firebaseapp.com",
  projectId: "test-class-well",
  storageBucket: "test-class-well.firebasestorage.app",
  messagingSenderId: "963396457322",
  appId: "1:963396457322:web:a5df12e520f4ffab0b4b13"
};

// Firebase, Firestore 및 Auth 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();


// ===================================================
// 데이터를 다루는 함수 세 개
// 백엔드 1 시간에 이 세 개가 Firestore를 쓰는 코드로 바뀝니다.
// ===================================================

// 메모를 읽어 옵니다.
// Firestore의 'memos' 컬렉션에서 작성 시각(createdAt) 순으로 가져옵니다.
async function loadMemos() {
  try {
    const q = query(collection(db, "memos"), orderBy("createdAt"));
    const querySnapshot = await getDocs(q);
    const memos = [];
    querySnapshot.forEach(function (docSnap) {
      memos.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    return memos;
  } catch (error) {
    console.error("메모를 불러오는 중 오류가 발생했습니다:", error);
    return [];
  }
}

// 메모를 새로 씁니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid)와 역할(rid)을 함께 저장하게 됩니다.
async function addMemo(text) {
  // 로그인 여부 확인
  if (!currentUser) {
    alert("교사 로그인 또는 학생 참여 후 메모를 작성할 수 있습니다.");
    return false;
  }

  // 5글자 이상일 때만 저장합니다.
  if (!text || text.trim().length < 5) {
    alert("메모는 5글자 이상 입력해 주세요.");
    return false;
  }

  try {
    await addDoc(collection(db, "memos"), {
      text: text,
      uid: currentUser.uid,
      author: currentUser.displayName,
      rid: currentUser.rid, // 'teacher' 또는 'student'
      createdAt: Date.now()
    });
    return true;
  } catch (error) {
    console.error("메모를 저장하는 중 오류가 발생했습니다:", error);
    alert("메모를 저장하지 못했습니다.\n\n[오류 원인]: " + (error.code || error.message) +
      "\n\nFirebase 콘솔(Firestore Database > 규칙)에서 읽기/쓰기 권한(allow read, write: if true;)이 설정되어 있는지 확인해 주세요.");
    return false;
  }
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  try {
    await deleteDoc(doc(db, "memos", id));
  } catch (error) {
    console.error("메모를 삭제하는 중 오류가 발생했습니다:", error);
    alert("메모를 삭제하지 못했습니다.\n\n[오류 원인]: " + (error.code || error.message));
  }
}


// ===================================================
// 화면 그리기
// ===================================================

async function render(memosList) {
  const wall = document.getElementById("wall");
  const memos = memosList || (await loadMemos());
  wall.innerHTML = "";

  memos.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  // 권한 검사:
  // - 교사(teacher): 모든 메모 삭제 가능 (관리 권한)
  // - 학생(student): 본인이 작성한 메모만 삭제 가능
  const isTeacher = currentUser && currentUser.rid === "teacher";
  const isMyMemo = currentUser && currentUser.uid === memo.uid;

  if (isTeacher || isMyMemo || !memo.uid) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.title = isTeacher && !isMyMemo ? "교사 권한으로 삭제" : "삭제";
    del.addEventListener("click", async function () {
      await deleteMemo(memo.id);
      await render();
    });
    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  // 작성자 및 역할(rid) 정보 표시
  const metaEl = document.createElement("div");
  metaEl.style.fontSize = "12px";
  metaEl.style.color = "#888";
  metaEl.style.marginTop = "8px";

  const roleText = memo.rid === "teacher" ? "👨‍🏫 [교사] " : (memo.rid === "student" ? "🧑‍🎓 [학생] " : "");
  metaEl.textContent = "- " + roleText + (memo.author || "익명");
  div.appendChild(metaEl);

  return div;
}


// ===================================================
// 사용자 인증 및 역할(rid) 구분
// 백엔드 2:
// - 교사(rid = 'teacher'): Google 로그인, 모든 메모 작성 및 삭제 가능
// - 학생(rid = 'student'): 익명 참여, 본인 메모만 작성 및 삭제 가능
// ===================================================

let currentUser = null;
const userArea = document.getElementById("userArea");

// 로그인 상태 변경 감지
onAuthStateChanged(auth, function (user) {
  if (user) {
    // 익명 로그인이면 학생(student), 구글 로그인이면 교사(teacher)로 구분합니다.
    const isAnonymous = user.isAnonymous;
    currentUser = {
      uid: user.uid,
      displayName: isAnonymous ? "익명 학생" : (user.displayName || "선생님"),
      isAnonymous: isAnonymous,
      rid: isAnonymous ? "student" : "teacher"
    };
  } else {
    currentUser = null;
  }

  updateUserArea();
  render(); // 역할 및 로그인 상태에 따라 삭제 권한을 다시 그립니다.
});

// 로그인 영역(userArea) 화면 표시
function updateUserArea() {
  if (!userArea) return;
  userArea.innerHTML = "";

  if (currentUser) {
    // 로그인된 상태: 역할 배지, 이름, 권한 설명 및 로그아웃 버튼 표시
    const roleBadge = currentUser.rid === "teacher" ? "👨‍🏫 [교사]" : "🧑‍🎓 [학생]";
    const roleDesc = currentUser.rid === "teacher" ? "(모든 메모 관리 권한)" : "(내 메모만 생성/삭제 가능)";

    const greeting = document.createElement("span");
    greeting.textContent = `${roleBadge} ${currentUser.displayName}님 ${roleDesc} `;
    userArea.appendChild(greeting);

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.style.marginLeft = "8px";
    logoutBtn.addEventListener("click", async function () {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("로그아웃 실패:", error);
      }
    });
    userArea.appendChild(logoutBtn);
  } else {
    // 로그인되지 않은 상태: 교사(Google) 및 학생(익명) 버튼 표시
    const teacherBtn = document.createElement("button");
    teacherBtn.textContent = "👨‍🏫 교사 로그인 (Google)";
    teacherBtn.style.marginRight = "8px";
    teacherBtn.addEventListener("click", async function () {
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error("교사 로그인 실패:", error);
        alert("로그인에 실패했습니다: " + (error.message || error.code));
      }
    });

    const studentBtn = document.createElement("button");
    studentBtn.textContent = "🧑‍🎓 학생 참여 (익명)";
    studentBtn.addEventListener("click", async function () {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("익명 로그인 실패:", error);
        if (error.code === "auth/operation-not-allowed") {
          alert("Firebase 콘솔(Authentication > Sign-in method)에서 '익명' 제공업체를 사용 설정해 주세요.");
        } else {
          alert("익명 참여에 실패했습니다: " + (error.message || error.code));
        }
      }
    });

    userArea.appendChild(teacherBtn);
    userArea.appendChild(studentBtn);
  }
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.addEventListener("keydown", async function (e) {
  // 한글 입력 중(조합 중) 발생하는 엔터는 무시하고 완성된 후 처리합니다.
  if (e.isComposing) return;

  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    // 로그인 여부 확인
    if (!currentUser) {
      alert("교사 로그인 또는 학생 참여 후 메모를 작성할 수 있습니다.");
      return;
    }

    const text = input.value.trim();
    if (text === "") return;

    // 5글자 이상인지 확인합니다.
    if (text.length < 5) {
      alert("메모는 5글자 이상 입력해 주세요.");
      return;
    }

    // 저장 성공 시에만 입력창을 비우고 화면을 갱신합니다.
    const success = await addMemo(text);
    if (success) {
      input.value = "";
      await render();
    }
  }
});


// 실시간 동기화 (다른 사람이 메모를 추가하거나 삭제했을 때도 자동 반영)
const memosQuery = query(collection(db, "memos"), orderBy("createdAt"));
onSnapshot(memosQuery, function (snapshot) {
  const list = [];
  snapshot.forEach(function (docSnap) {
    list.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });
  render(list);
}, function (error) {
  console.warn("실시간 동기화 오류 (Firestore 보안 규칙을 확인하세요):", error);
});

// 첫 화면 그리기
render();
input.focus();
