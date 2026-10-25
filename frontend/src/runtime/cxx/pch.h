// Precompiled into public/cxx/stdc++.pch (scripts/prepare-cxx.mjs) and
// force-included in every C++ program: the whole standard library, GCC's
// __gcd/__lg, and the templates programs use most, instantiated once here
// (-fpch-instantiate-templates) instead of in every compile.
#include <bits/stdc++.h>

// GCC (libstdc++) extensions that C++ courses and judges use a lot
namespace std {
inline int __gcd(int a, int b) { while (b) { int t = a % b; a = b; b = t; } return a; }
inline long __gcd(long a, long b) { while (b) { long t = a % b; a = b; b = t; } return a; }
inline long long __gcd(long long a, long long b) { while (b) { long long t = a % b; a = b; b = t; } return a; }
inline int __lg(int n) { return 31 - __builtin_clz(static_cast<unsigned>(n)); }
inline int __lg(unsigned n) { return 31 - __builtin_clz(n); }
inline int __lg(long n) { return 31 - __builtin_clzl(static_cast<unsigned long>(n)); }
inline int __lg(unsigned long n) { return 31 - __builtin_clzl(n); }
inline int __lg(long long n) { return 63 - __builtin_clzll(static_cast<unsigned long long>(n)); }
inline int __lg(unsigned long long n) { return 63 - __builtin_clzll(n); }
}  // namespace std

namespace __aivex_pch {
inline void instantiate_common_templates() {
  using namespace std;
  int i = 0;
  long long ll = 0;
  double d = 0;
  float f = 0;
  char c = 0;
  string s = "x";
  cin >> i >> ll >> d >> f >> c >> s;
  getline(cin, s);
  cout << i << ll << d << f << c << s << "x" << endl << fixed << setprecision(2) << d << '\n';
  printf("%d", i);
  scanf("%d", &i);

  s += "y";
  s += 'c';
  s = s.substr(0, 1) + to_string(i);
  i = stoi(s) + static_cast<int>(s.find("x") + s.size());

  vector<int> vi = {1, 2};
  vi.push_back(1);
  vi.emplace_back(2);
  vi.resize(3);
  vi.at(0) = vi[1];
  sort(vi.begin(), vi.end());
  sort(vi.begin(), vi.end(), greater<int>());
  reverse(vi.begin(), vi.end());
  i = accumulate(vi.begin(), vi.end(), 0) + *max_element(vi.begin(), vi.end()) + *min_element(vi.begin(), vi.end());
  vector<long long> vl = {1};
  vl.push_back(1);
  sort(vl.begin(), vl.end());
  vector<double> vd = {1.0};
  vd.push_back(1.0);
  vector<string> vs = {"a"};
  vs.push_back("a");
  sort(vs.begin(), vs.end());
  vector<char> vc = {'a'};
  vc.push_back('a');
  vector<bool> vb(3);
  vb[0] = true;
  vector<vector<int>> vv(2, vector<int>(2));
  vv[0][0] = 1;
  vector<pair<int, int>> vp = {{1, 2}};
  vp.push_back({1, 2});
  sort(vp.begin(), vp.end());

  map<int, int> mi;
  mi[1]++;
  i += static_cast<int>(mi.count(1)) + mi.find(1)->second;
  map<string, int> ms;
  ms["a"]++;
  map<char, int> mc;
  mc['a']++;
  set<int> si = {1};
  si.insert(1);
  set<string> ss = {"a"};
  unordered_map<int, int> ui;
  ui[1]++;
  unordered_map<string, int> us;
  us["a"]++;
  unordered_set<int> usi = {1};
  queue<int> q;
  q.push(1);
  q.pop();
  stack<int> st;
  st.push(1);
  st.pop();
  priority_queue<int> pq;
  pq.push(1);
  pq.pop();
  deque<int> dq = {1};
  dq.push_front(1);
  pair<int, int> p = make_pair(1, 2);

  i = max(i, p.first) + min(i, p.second) + abs(i);
  ll = max(ll, ll) + min(ll, ll);
  swap(i, p.first);
  d = sqrt(d) + pow(d, 2.0);
  unique_ptr<int> up = make_unique<int>(1);
  shared_ptr<int> sp = make_shared<int>(1);
  try {
    throw runtime_error("x");
  } catch (const exception& e) {
    s = e.what();
  }
}
}  // namespace __aivex_pch
