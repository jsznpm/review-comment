// Source of truth for the seeded fixtures. Run `node tests/fixtures/build.mjs` after editing to
// regenerate <lang>/change.diff and <lang>/expected.json. Expected lines are found by a unique
// substring, so the sources can be edited without recounting line numbers.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const FIXTURES = {
  csharp: {
    path: 'src/Orders/OrderService.cs',
    issues: [
      ['public static List<Order> RecentOrders', 'CS-011'],
      ['public async void PlaceOrder', 'CS-001'],
      ['FindAsync(customerId).Result', 'CS-002'],
      ['catch (Exception)', 'CS-005'],
      ['new StreamWriter(path)', 'CS-004'],
      ['FindAsync(order.CustomerId)', 'CS-016'],
      ['new HttpClient()', 'CS-017'],
    ],
    source: `using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;

namespace Shop.Orders;

public class OrderService
{
    public static List<Order> RecentOrders = new List<Order>();
    private readonly ShopDbContext _db;

    public OrderService(ShopDbContext db)
    {
        _db = db;
    }

    public async void PlaceOrder(Order order)
    {
        _db.Orders.Add(order);
        await _db.SaveChangesAsync();
        RecentOrders.Add(order);
    }

    public decimal GetDiscount(string customerId)
    {
        var customer = _db.Customers.FindAsync(customerId).Result;
        try
        {
            return customer.Points > 1000 ? 0.1m : 0m;
        }
        catch (Exception)
        {
            return 0m;
        }
    }

    public async Task<string> ExportAsync(string path)
    {
        var writer = new StreamWriter(path);
        foreach (var order in _db.Orders.ToList())
        {
            var customer = await _db.Customers.FindAsync(order.CustomerId);
            await writer.WriteLineAsync($"{order.Id};{customer.Name}");
        }
        using var http = new HttpClient();
        return await http.GetStringAsync("https://example.com/ack");
    }
}
`,
  },

  go: {
    path: 'internal/worker/worker.go',
    issues: [
      ['var cache map[string]Item', 'GO-011'],
      ['func (c Counter) Inc()', 'GO-008'],
      ['data, _ := os.ReadFile(path)', 'GO-001'],
      ['resp, err := http.Get(url)', 'GO-016'],
      ['cache[it.ID] = it', 'GO-014'],
      ['go func() {', 'GO-006'],
      ['panic(err)', 'GO-004'],
    ],
    source: `package worker

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"sync"
)

var cache map[string]Item

type Item struct {
	ID   string \`json:"id"\`
	Name string \`json:"name"\`
}

type Counter struct {
	mu sync.Mutex
	n  int
}

func (c Counter) Inc() {
	c.mu.Lock()
	c.n++
	c.mu.Unlock()
}

func LoadConfig(path string) []byte {
	data, _ := os.ReadFile(path)
	return data
}

func Fetch(url string) (Item, error) {
	var it Item
	resp, err := http.Get(url)
	if err != nil {
		return it, err
	}
	err = json.NewDecoder(resp.Body).Decode(&it)
	return it, err
}

func Store(it Item) {
	cache[it.ID] = it
}

func StartWorkers(jobs chan Item) {
	for i := 0; i < 4; i++ {
		go func() {
			for {
				Store(<-jobs)
			}
		}()
	}
}

func MustPort(s string) int {
	p, err := strconv.Atoi(s)
	if err != nil {
		panic(err)
	}
	return p
}
`,
  },

  java: {
    path: 'src/main/java/shop/ReportService.java',
    issues: [
      ['public static Map<String, Double> TOTALS', 'JAVA-007'],
      ['private OrderRepository orders;', 'JAVA-011'],
      ['new BufferedReader(new FileReader(path))', 'JAVA-001'],
      ['o.getId() == id', 'JAVA-013'],
      ['return null;', 'JAVA-002'],
      ['double sum = 0;', 'JAVA-015'],
      ['catch (InterruptedException e)', 'JAVA-006'],
      ['forEach(o -> names.add', 'JAVA-012'],
    ],
    source: `package shop;

import java.io.BufferedReader;
import java.io.FileReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class ReportService {
    public static Map<String, Double> TOTALS = new HashMap<>();

    @Autowired
    private OrderRepository orders;

    public String firstLine(String path) throws Exception {
        BufferedReader reader = new BufferedReader(new FileReader(path));
        String line = reader.readLine();
        reader.close();
        return line;
    }

    public Order findOrder(String id) {
        for (Order o : orders.findAll()) {
            if (o.getId() == id) {
                return o;
            }
        }
        return null;
    }

    public double total(List<Order> list) {
        double sum = 0;
        for (Order o : list) {
            sum += o.getPrice() * o.getQuantity();
        }
        return sum;
    }

    public void waitForBatch() {
        try {
            Thread.sleep(5000);
        } catch (InterruptedException e) {
        }
    }

    public List<String> paidCustomers(List<Order> list) {
        List<String> names = new ArrayList<>();
        list.stream().filter(Order::isPaid).forEach(o -> names.add(o.getCustomer()));
        return names;
    }
}
`,
  },

  typescript: {
    path: 'src/billing/invoice.ts',
    issues: [
      ['export let lastInvoice', 'TS-011'],
      ['loadInvoice(id: any)', 'TS-001'],
      ['(await res.json()) as Invoice', 'TS-004'],
      ['invoice.amount > 5000', 'GEN-006'],
      ['i.id === id)!', 'TS-002'],
      ["api.post('/reminders'", 'TS-005'],
      ['} catch (e) {}', 'GEN-008'],
    ],
    source: `import { api } from '../lib/api';

export interface Invoice {
  id: string;
  amount: number;
  status: string;
}

export let lastInvoice: Invoice | null = null;

export async function loadInvoice(id: any) {
  const res = await fetch(\`/api/invoices/\${id}\`);
  const invoice = (await res.json()) as Invoice;
  lastInvoice = invoice;
  return invoice;
}

export function lateFee(invoice: Invoice): number {
  if (invoice.amount > 5000) {
    return invoice.amount * 0.035;
  }
  return 0;
}

export function sendReminder(invoices: Invoice[], id: string) {
  const invoice = invoices.find((i) => i.id === id)!;
  api.post('/reminders', { invoiceId: invoice.id });
}

export function archive(invoice: Invoice) {
  try {
    api.archive(invoice.id);
  } catch (e) {}
}
`,
  },

  javascript: {
    path: 'src/cart.js',
    issues: [
      ['var cartTotal = 0;', 'JS-002'],
      ['cart.items.push(item);', 'JS-004'],
      ['cart.items.length == 0', 'JS-001'],
      ['prices.push(await fetchPrice(id));', 'JS-005'],
      ['el.innerHTML =', 'JS-008'],
      ['parseInt(code.slice(-2))', 'JS-011'],
      ["saveCart(cart).then(() => redirect('/done'));", 'JS-006'],
    ],
    source: `var cartTotal = 0;

export function addItem(cart, item) {
  cart.items.push(item);
  cartTotal = cartTotal + item.price;
  return cart;
}

export function isEmpty(cart) {
  return cart.items.length == 0;
}

export async function loadPrices(ids) {
  const prices = [];
  for (const id of ids) {
    prices.push(await fetchPrice(id));
  }
  return prices;
}

export function renderCart(cart, el) {
  el.innerHTML = cart.items.map((i) => \`<li>\${i.name}</li>\`).join('');
}

export function applyCoupon(code) {
  const pct = parseInt(code.slice(-2));
  return pct;
}

export function checkout(cart) {
  saveCart(cart).then(() => redirect('/done'));
}
`,
  },

  react: {
    path: 'src/features/orders/components/OrdersPage.tsx',
    issues: [
      ["from '@/features/billing/utils/format-price'", 'REACT-012'],
      ['fetch(`/api/customers/${customerId}/orders`)', 'REACT-011'],
      ['}, []);', 'REACT-003'],
      ['setUnpaid(orders.filter', 'REACT-001'],
      ['const Row = ({ order }', 'REACT-008'],
      ['<div onClick={() => setOrders([])}>', 'REACT-017'],
      ['<Row key={i}', 'REACT-005'],
    ],
    source: `import { useEffect, useState } from 'react';
import { formatPrice } from '@/features/billing/utils/format-price';

type Order = { id: string; total: number; paid: boolean };

export function OrdersPage({ customerId }: { customerId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [unpaid, setUnpaid] = useState<Order[]>([]);

  useEffect(() => {
    fetch(\`/api/customers/\${customerId}/orders\`)
      .then((r) => r.json())
      .then(setOrders);
  }, []);

  useEffect(() => {
    setUnpaid(orders.filter((o) => !o.paid));
  }, [orders]);

  const Row = ({ order }: { order: Order }) => (
    <tr>
      <td>{order.id}</td>
      <td>{formatPrice(order.total)}</td>
    </tr>
  );

  return (
    <div>
      <div onClick={() => setOrders([])}>Clear</div>
      <table>
        <tbody>
          {unpaid.map((order, i) => (
            <Row key={i} order={order} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
`,
  },
};

function lineOf(lines, needle, lang) {
  const hits = lines.flatMap((l, i) => (l.includes(needle) ? [i + 1] : []));
  if (hits.length !== 1) throw new Error(`${lang}: "${needle}" found ${hits.length} times, must be unique`);
  return hits[0];
}

for (const [lang, fx] of Object.entries(FIXTURES)) {
  const lines = fx.source.replace(/\n$/, '').split('\n');
  const diff = [
    `diff --git a/${fx.path} b/${fx.path}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${fx.path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((l) => `+${l}`),
    '',
  ].join('\n');
  const expected = {
    path: fx.path,
    issues: fx.issues.map(([needle, ruleId]) => ({ line: lineOf(lines, needle, lang), ruleId, hint: needle })),
  };
  const dir = path.join(here, lang);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'change.diff'), diff);
  fs.writeFileSync(path.join(dir, 'expected.json'), `${JSON.stringify(expected, null, 2)}\n`);
  console.log(`${lang}: ${expected.issues.length} seeded issues`);
}
