// Wasm exceptions have no unwinder search phase, so an exception nobody
// catches leaves the program as a WebAssembly.Exception instead of reaching
// std::terminate. The runner calls this with the exception's payload to print
// the message GCC's runtime would.
#include <cstdio>
#include <cstdlib>
#include <cxxabi.h>
#include <exception>
#include <typeinfo>

extern "C" void* __cxa_begin_catch(void*) noexcept;

extern "C" __attribute__((export_name("__aivex_uncaught"))) void __aivex_uncaught(void* unwind_exception) {
  std::fflush(stdout); // what the program printed before the throw
  __cxa_begin_catch(unwind_exception);
  const std::type_info* type = abi::__cxa_current_exception_type();
  int status = 0;
  char* name = type ? abi::__cxa_demangle(type->name(), nullptr, nullptr, &status) : nullptr;
  const char* shown = name ? name : type ? type->name() : "unknown";
  try {
    throw;
  } catch (const std::exception& e) {
    std::fprintf(stderr, "terminate called after throwing an instance of '%s'\n  what():  %s\n", shown, e.what());
  } catch (...) {
    std::fprintf(stderr, "terminate called after throwing an instance of '%s'\n", shown);
  }
  std::fflush(stderr);
}
