1. vue setup只执行一次，react render执行多次
2. ref和useState，ref的get set操作一体，useState是分离的且是字面量，心智模型不同，
3. 副作用有过期闭包的心智负担
4. 必须手动声明useEffect依赖
5. useMemo和useCallback需要手动优化