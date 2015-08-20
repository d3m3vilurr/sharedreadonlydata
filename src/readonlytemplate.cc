#include <iostream>
#include <v8.h>
#include <node.h>

using namespace node;
using namespace v8;

class ReadOnlyTemplate: ObjectWrap
{
private:

public:

	static Persistent<FunctionTemplate> SuperClass;
	static void Init(Handle<Object> target)
	{
		HandleScope scope;

		Local<FunctionTemplate> t = FunctionTemplate::New(New);

		SuperClass = Persistent<FunctionTemplate>::New(t);
		SuperClass->InstanceTemplate()->SetInternalFieldCount(1);
		SuperClass->SetClassName(String::NewSymbol("ReadOnlyTemplate"));
		NODE_SET_PROTOTYPE_METHOD(SuperClass, "create", CreateReadOnlyTemplate);

		target->Set(String::NewSymbol("ReadOnlyTemplate"), SuperClass->GetFunction());

		scope.Close(Handle<Value>(NULL));
	}

	ReadOnlyTemplate()
	{
	}

	~ReadOnlyTemplate()
	{
	}

	static Handle<Value> New(const Arguments& args)
	{
		HandleScope scope;
		ReadOnlyTemplate* hw = new ReadOnlyTemplate();
		hw->Wrap(args.This());

		return scope.Close(args.This());
	}

	static Handle<Value> GetByName(v8::Local<v8::String> name, const AccessorInfo &info) {
		HandleScope scope;

		// Send real properties untouched
		Local<Value> value =  info.This()->GetRealNamedProperty(name);
		if (!value.IsEmpty()) {
			return scope.Close(value);
		}

		Local<String> getter = String::New("__get__");

		Handle<Value> accessor = info.This()->GetRealNamedPropertyInPrototypeChain(getter);
		if (!accessor.IsEmpty() && accessor->IsFunction()) {
			Handle<Function> accessorFn = Handle<Function>(Function::Cast(*accessor));
			int argc=1;
			Local<Value> argv[1];
			argv[0] = name;
			Local<Value> dynamicProperty = accessorFn->Call(info.This(), argc, argv);
			return scope.Close(dynamicProperty);
		} else {
			return scope.Close(accessor);
		}

		return scope.Close(Handle<Value>(NULL));
	}

	static Handle<Value> GetByIndex(uint32_t index, const AccessorInfo &info) {
		HandleScope scope;

		Local<String> getter = String::New("__get__");
		Handle<Value> accessor = info.This()->GetRealNamedPropertyInPrototypeChain(getter);
		if (!accessor.IsEmpty() && accessor->IsFunction()) {
			Handle<Function> accessorFn = Handle<Function>(Function::Cast(*accessor));
			int argc=1;
			Local<Value> argv[1];
			argv[0] = Number::New(index);
			Local<Value> dynamicProperty = accessorFn->Call(info.This(), argc, argv);
			String::Utf8Value res2(dynamicProperty->ToString());
			return scope.Close(dynamicProperty);
		} else {
			return scope.Close(accessor);
		}
		return scope.Close(Handle<Value>(NULL));
	}

	static Handle<Array> Enum(const AccessorInfo &info)  {
		HandleScope scope;

		Local<String> enumerator = String::New("__enum__");
		Handle<Value> accessor = info.This()->GetRealNamedPropertyInPrototypeChain(enumerator);
		if (!accessor.IsEmpty() && accessor->IsFunction()) {
			Handle<Function> accessorFn = Handle<Function>(Function::Cast(*accessor));
			int argc=0;
			Local<Value> result = accessorFn->Call(info.This(), argc, NULL);
			return scope.Close(Local<Array>::Cast(result));
		}
		return scope.Close(Handle<Array>(NULL));
	}

	static Handle<Value> CreateReadOnlyTemplate(const Arguments& args)
	{
		HandleScope scope;

		Local<FunctionTemplate> t = FunctionTemplate::New(New);

		SuperClass = Persistent<FunctionTemplate>::New(t);
		SuperClass->InstanceTemplate()->SetInternalFieldCount(2);
		SuperClass->SetClassName(String::NewSymbol("ReadOnlyTemplate"));
		SuperClass->InstanceTemplate()->SetNamedPropertyHandler(GetByName, NULL, NULL, NULL, NULL);
		SuperClass->InstanceTemplate()->SetIndexedPropertyHandler(GetByIndex, NULL, NULL, NULL, Enum);
		return scope.Close(SuperClass->GetFunction());
	}
};

Persistent<FunctionTemplate> ReadOnlyTemplate::SuperClass;

extern "C" {
	static void init (Handle<Object> target)
	{
		ReadOnlyTemplate::Init(target);
	}

	NODE_MODULE(readonlytemplate, init);
}
