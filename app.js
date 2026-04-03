// ==========================================
// 【重要】Firebaseの設定
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDEYoOoQxZw06jgLLC05E1823MJttHQxwtY",
  authDomain: "test-zaikokanri.firebaseapp.com",
  projectId: "test-zaikokanri",
  storageBucket: "test-zaikokanri.firebasestorage.app",
  messagingSenderId: "338908354924",
  appId: "1:338908354924:web:75e63080c558c7365c490a",
  measurementId: "G-6W3F8N5X3L"
};

// ==========================================
// 【重要】Google Apps Script (GAS) のURL
// ==========================================
const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwjGNGPGSzDf6BOquPnQp-mmUVf6hlPRGWvk4Ff7pfvooY9nqfgoPBu-6GOyG1OEsaB/exec";

// DBの初期化（ブラウザ制限に強い互換モード）
let db;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
} catch (error) {
    console.warn("Firebaseの初期化に失敗しました。設定を確認してください。");
}

let inventoryData = [];
const listContainer = document.getElementById('inventory-list');

// アイテムの描画関数
function renderInventory() {
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (inventoryData.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; color: #718096; padding: 40px 20px;">データがありません。<br><button onclick="seedData()" style="margin-top: 20px; padding: 12px 24px; border-radius: 30px; background: #4299e1; color: white; border: none; cursor: pointer; font-weight: bold; box-shadow: 0 4px 10px rgba(66, 153, 225, 0.3);">サンプルの日用品を登録する</button></div>';
        return;
    }

    inventoryData.forEach(item => {
        const isLowStock = item.quantity <= 1;
        const cardClass = isLowStock ? 'item-card low-stock' : 'item-card';
        
        const thumbnailHtml = item.image 
            ? `<img src="${item.image}" alt="${item.name}" class="item-thumbnail">` 
            : `<div class="item-thumbnail placeholder-img">📦</div>`;

        const card = document.createElement('div');
        card.className = cardClass;
        card.innerHTML = `
            ${thumbnailHtml}
            <div class="item-info">
                <div class="item-category">${item.category}</div>
                <div class="item-name">${item.name}</div>
            </div>
            <div class="item-actions">
                <button class="action-btn btn-decrease" onclick="updateQuantity('${item.id}', -1)">−</button>
                <div class="quantity-display" id="qty-${item.id}">${item.quantity}</div>
                <button class="action-btn btn-increase" onclick="updateQuantity('${item.id}', 1)">＋</button>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

// データのリアルタイム監視機能（Firebase）
if (db) {
    db.collection("items").orderBy("orderIndex")
    .onSnapshot((snapshot) => {
        inventoryData = [];
        snapshot.forEach((docItem) => {
            inventoryData.push({ id: docItem.id, ...docItem.data() });
        });
        renderInventory();
    }, (error) => {
        console.error("Firestore監視エラー:", error);
    });
}

// 在庫数の増減関数（クラウドへ保存）
window.updateQuantity = async function(id, change) {
    if (!db) {
        alert("Firebaseの設定が完了していません！");
        return;
    }

    const item = inventoryData.find(i => i.id === id);
    if (!item) return;

    const newQuantity = Math.max(0, item.quantity + change);

    // 【1】画面はすぐ更新する（スムーズな操作感のため）
    const qtyElement = document.getElementById(`qty-${id}`);
    if (qtyElement) {
        qtyElement.textContent = newQuantity;
        qtyElement.classList.add('pop-animation');
        setTimeout(() => {
            qtyElement.classList.remove('pop-animation');
        }, 300);
    }

    // 【2】裏側でデータベースを更新
    try {
        await db.collection("items").doc(id).update({ quantity: newQuantity });
        
        // 【3】スプレッドシート（GAS）へ履歴を送信
        const currentUser = document.getElementById('user-select').value;
        const actionText = change > 0 ? "補充した" : "使った";
        const amountAbs = Math.abs(change);
        
        if (GAS_WEBAPP_URL && GAS_WEBAPP_URL.startsWith("http")) {
            fetch(GAS_WEBAPP_URL, {
                method: "POST",
                mode: "no-cors",
                body: JSON.stringify({
                    date: new Date().toLocaleString("ja-JP"),
                    user: currentUser,
                    itemName: item.name,
                    category: item.category,
                    action: actionText,
                    amount: amountAbs,
                    resultQuantity: newQuantity
                })
            }).catch(err => console.error("GAS送信エラー:", err));
        }

    } catch (error) {
        console.error("更新エラー:", error);
    }
}

// データベースが空の時にサンプルアイテムを入れる機能
window.seedData = async function() {
    if (!db) {
        alert("Firebaseの初期化に失敗しています。");
        return;
    }

    const initialData = [
        { name: 'トイレットペーパー', category: 'バス・トイレ', quantity: 12, image: null, orderIndex: 1 },
        { name: '洗濯洗剤', category: 'ランドリー', quantity: 2, image: '洗濯洗剤.png', orderIndex: 2 },
        { name: '食器用洗剤', category: 'キッチン', quantity: 1, image: '食器用洗剤.png', orderIndex: 3 },
        { name: 'シャンプー詰め替え', category: 'バス・トイレ', quantity: 0, image: null, orderIndex: 4 },
        { name: 'ティッシュペーパー', category: 'リビング', quantity: 5, image: null, orderIndex: 5 }
    ];

    try {
        const itemsRef = db.collection("items");
        for (const item of initialData) {
            await itemsRef.add(item);
        }
        alert("Firebaseにサンプルデータを登録しました！");
    } catch (e) {
        alert("書き込み権限がないか、エラーが発生しました。Firestoreのルールを「テストモード」に設定しているか確認してください。");
        console.error(e);
    }
}

// 初回起動時の処理
document.addEventListener('DOMContentLoaded', () => {
    // 初回描画
    renderInventory();

    // 誰が操作しているかを保存・復元
    const userSelect = document.getElementById('user-select');
    if (userSelect) {
        userSelect.value = localStorage.getItem('currentUser') || '夫';
        userSelect.addEventListener('change', (e) => {
            localStorage.setItem('currentUser', e.target.value);
        });
    }

    // アイテム追加用のダミー
    const addBtn = document.getElementById('add-item-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            alert('（新規追加画面を開く予定です）');
        });
    }
});
